using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json.Serialization;
using BabyRoutine.Application.Common.Models;
using BabyRoutine.Application.Features.Auth;
using Google.Apis.Auth;
using Microsoft.IdentityModel.Tokens;

namespace BabyRoutine.Api.Services;

public class GoogleAuthService(
    IConfiguration configuration,
    HttpClient httpClient,
    ILogger<GoogleAuthService> logger) : IGoogleSsoValidator
{
    private string? _runtimeClientId;

    public string JwtSecret =>
        Environment.GetEnvironmentVariable("JWT_SECRET")
        ?? configuration["Jwt:Secret"]
        ?? "BabyRoutine_SuperSecret_JwtKey_2026_Minimum32BytesLong!";

    public string JwtIssuer => configuration["Jwt:Issuer"] ?? "BabyRoutine.Api";
    public string JwtAudience => configuration["Jwt:Audience"] ?? "BabyRoutine.Frontend";

    public string? GoogleClientId
    {
        get
        {
            var id = _runtimeClientId
                     ?? Environment.GetEnvironmentVariable("GOOGLE_CLIENT_ID")
                     ?? configuration["Google:ClientId"];
            return string.IsNullOrWhiteSpace(id) || id.StartsWith("YOUR_GOOGLE_CLIENT_ID", StringComparison.OrdinalIgnoreCase)
                ? null
                : id.Trim();
        }
    }

    public string? GoogleClientSecret =>
        Environment.GetEnvironmentVariable("GOOGLE_CLIENT_SECRET")
        ?? configuration["Google:ClientSecret"];

    public void SetRuntimeClientId(string clientId)
    {
        if (!string.IsNullOrWhiteSpace(clientId))
        {
            _runtimeClientId = clientId.Trim();
        }
    }

    public async Task<GoogleSsoPayload> ValidateAsync(GoogleLoginRequestDto dto, CancellationToken ct = default)
    {
        // 1. Fluxo OIDC ID Token (Google Identity Services / One-Tap / Sign In With Google Button)
        if (!string.IsNullOrWhiteSpace(dto.IdToken))
        {
            return await ValidateGoogleIdTokenAsync(dto.IdToken);
        }

        // 2. Fluxo OAuth 2.0 Authorization Code (Code Flow / Redirect ou Popup Code Client)
        if (!string.IsNullOrWhiteSpace(dto.AuthorizationCode))
        {
            return await ExchangeCodeAndValidateAsync(dto.AuthorizationCode, dto.RedirectUri, ct);
        }

        // 3. Fluxo OAuth 2.0 Access Token (Google Identity Services initTokenClient Popup SSO)
        if (!string.IsNullOrWhiteSpace(dto.AccessToken))
        {
            return await ValidateGoogleAccessTokenAsync(dto.AccessToken, ct);
        }

        throw new UnauthorizedAccessException("Token de autenticação Google SSO (idToken, accessToken ou authorizationCode) é obrigatório.");
    }

    private async Task<GoogleSsoPayload> ValidateGoogleIdTokenAsync(string idToken)
    {
        try
        {
            var settings = new GoogleJsonWebSignature.ValidationSettings();
            if (!string.IsNullOrWhiteSpace(GoogleClientId))
            {
                settings.Audience = [GoogleClientId];
            }

            var payload = await GoogleJsonWebSignature.ValidateAsync(idToken, settings);
            if (!payload.EmailVerified)
            {
                throw new UnauthorizedAccessException("O endereço de e-mail da Conta Google não está verificado.");
            }

            return new GoogleSsoPayload(
                GoogleSub: payload.Subject,
                Email: payload.Email.Trim().ToLowerInvariant(),
                EmailVerified: payload.EmailVerified,
                Name: string.IsNullOrWhiteSpace(payload.Name) ? payload.Email.Split('@')[0] : payload.Name,
                PictureUrl: payload.Picture ?? string.Empty
            );
        }
        catch (InvalidJwtException ex)
        {
            logger.LogWarning(ex, "Falha na validação criptográfica do Google ID Token.");
            throw new UnauthorizedAccessException("Google ID Token inválido ou expirado.", ex);
        }
    }

    private async Task<GoogleSsoPayload> ValidateGoogleAccessTokenAsync(string accessToken, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, "https://openidconnect.googleapis.com/v1/userinfo");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        using var response = await httpClient.SendAsync(req, ct);
        if (!response.IsSuccessStatusCode)
        {
            logger.LogWarning("Google OIDC UserInfo retornou status {StatusCode}.", response.StatusCode);
            throw new UnauthorizedAccessException("Access Token do Google SSO inválido ou expirado.");
        }

        var userInfo = await response.Content.ReadFromJsonAsync<GoogleOidcUserInfoResponse>(cancellationToken: ct);
        if (userInfo is null || string.IsNullOrWhiteSpace(userInfo.Sub) || string.IsNullOrWhiteSpace(userInfo.Email))
        {
            throw new UnauthorizedAccessException("Resposta do Google OIDC UserInfo não contém sub/email válidos.");
        }

        if (!userInfo.EmailVerified)
        {
            throw new UnauthorizedAccessException("O endereço de e-mail da Conta Google não está verificado.");
        }

        return new GoogleSsoPayload(
            GoogleSub: userInfo.Sub,
            Email: userInfo.Email.Trim().ToLowerInvariant(),
            EmailVerified: userInfo.EmailVerified,
            Name: string.IsNullOrWhiteSpace(userInfo.Name) ? userInfo.Email.Split('@')[0] : userInfo.Name,
            PictureUrl: userInfo.Picture ?? string.Empty
        );
    }

    private async Task<GoogleSsoPayload> ExchangeCodeAndValidateAsync(string code, string? redirectUri, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(GoogleClientId) || string.IsNullOrWhiteSpace(GoogleClientSecret))
        {
            throw new UnauthorizedAccessException("Google ClientId e ClientSecret devem estar configurados no servidor para troca de Authorization Code.");
        }

        var form = new Dictionary<string, string>
        {
            ["code"] = code,
            ["client_id"] = GoogleClientId,
            ["client_secret"] = GoogleClientSecret,
            ["redirect_uri"] = string.IsNullOrWhiteSpace(redirectUri) ? "postmessage" : redirectUri,
            ["grant_type"] = "authorization_code"
        };

        using var response = await httpClient.PostAsync("https://oauth2.googleapis.com/token", new FormUrlEncodedContent(form), ct);
        if (!response.IsSuccessStatusCode)
        {
            throw new UnauthorizedAccessException("Falha ao trocar Authorization Code junto ao Google OAuth 2.0.");
        }

        var tokenRes = await response.Content.ReadFromJsonAsync<GoogleTokenExchangeResponse>(cancellationToken: ct);
        if (!string.IsNullOrWhiteSpace(tokenRes?.IdToken))
        {
            return await ValidateGoogleIdTokenAsync(tokenRes.IdToken);
        }

        if (!string.IsNullOrWhiteSpace(tokenRes?.AccessToken))
        {
            return await ValidateGoogleAccessTokenAsync(tokenRes.AccessToken, ct);
        }

        throw new UnauthorizedAccessException("O Google OAuth 2.0 não retornou id_token ou access_token válidos.");
    }

    public string GenerateJwtToken(UserAccount user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(JwtSecret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id),
            new(JwtRegisteredClaimNames.Sub, user.Id),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new(ClaimTypes.Name, user.Name),
            new("google_sub", user.GoogleSub),
            new("picture", user.PictureUrl),
            new("family_id", user.FamilyId)
        };

        var token = new JwtSecurityToken(
            issuer: JwtIssuer,
            audience: JwtAudience,
            claims: claims,
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private sealed class GoogleOidcUserInfoResponse
    {
        [JsonPropertyName("sub")]
        public string Sub { get; set; } = string.Empty;

        [JsonPropertyName("email")]
        public string Email { get; set; } = string.Empty;

        [JsonPropertyName("email_verified")]
        public bool EmailVerified { get; set; }

        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("picture")]
        public string? Picture { get; set; }
    }

    private sealed class GoogleTokenExchangeResponse
    {
        [JsonPropertyName("access_token")]
        public string? AccessToken { get; set; }

        [JsonPropertyName("id_token")]
        public string? IdToken { get; set; }
    }
}

public static class ClaimsPrincipalExtensions
{
    public static string GetCurrentUserId(this HttpContext httpContext)
    {
        var claimId = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)
                      ?? httpContext.User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        return claimId ?? string.Empty;
    }

    public static string GetCurrentUserName(this HttpContext httpContext)
    {
        var claimName = httpContext.User.FindFirstValue(ClaimTypes.Name);
        return !string.IsNullOrWhiteSpace(claimName) ? claimName : "Responsável";
    }
}
