using BabyRoutine.Application.Common.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace BabyRoutine.Infrastructure.Persistence;

public class MongoDbContext
{
    private readonly IMongoDatabase? _database;
    private readonly ILogger<MongoDbContext> _logger;
    public bool IsMongoConnected { get; private set; }

    public MongoDbContext(IConfiguration configuration, ILogger<MongoDbContext> logger)
    {
        _logger = logger;
        var connectionString = Environment.GetEnvironmentVariable("MONGODB_URI")
                               ?? Environment.GetEnvironmentVariable("MONGO_URL")
                               ?? Environment.GetEnvironmentVariable("MONGO_CONNECTION_STRING")
                               ?? configuration.GetConnectionString("MongoDb")
                               ?? configuration["MongoDb:ConnectionString"];
        var databaseName = Environment.GetEnvironmentVariable("MONGODB_DATABASE")
                           ?? configuration["MongoDb:DatabaseName"]
                           ?? "baby_routine_db";

        if (!string.IsNullOrWhiteSpace(connectionString) &&
            !connectionString.Equals("InMemory", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                var mongoUrl = new MongoUrl(connectionString);
                if (!string.IsNullOrWhiteSpace(mongoUrl.DatabaseName))
                {
                    databaseName = mongoUrl.DatabaseName;
                }

                var isLocalhost = connectionString.Contains("localhost", StringComparison.OrdinalIgnoreCase) ||
                                  connectionString.Contains("127.0.0.1", StringComparison.OrdinalIgnoreCase);
                var timeout = isLocalhost ? TimeSpan.FromSeconds(2) : TimeSpan.FromSeconds(6);

                var settings = MongoClientSettings.FromUrl(mongoUrl);
                settings.ServerSelectionTimeout = timeout;
                settings.ConnectTimeout = timeout;
                var client = new MongoClient(settings);
                _database = client.GetDatabase(databaseName);
                _database.RunCommand((Command<MongoDB.Bson.BsonDocument>)"{ping:1}");
                IsMongoConnected = true;
                EnsureIndexes();
                _logger.LogInformation("Connected to MongoDB database '{DatabaseName}' and verified multi-user/multi-child composite indexes.", databaseName);
            }
            catch (Exception ex)
            {
                IsMongoConnected = false;
                _logger.LogWarning("MongoDB connection unavailable ({Message}). Running with persistent file-backed store.", ex.Message);
            }
        }
    }

    public IMongoCollection<UserAccount>? Users => _database?.GetCollection<UserAccount>("users");
    public IMongoCollection<Family>? Families => _database?.GetCollection<Family>("families");
    public IMongoCollection<Baby>? Babies => _database?.GetCollection<Baby>("babies");
    public IMongoCollection<RoutineEvent>? RoutineEvents => _database?.GetCollection<RoutineEvent>("routine_events");
    public IMongoCollection<AllergenTrial>? AllergenTrials => _database?.GetCollection<AllergenTrial>("allergen_trials");
    public IMongoCollection<MilestoneProgress>? Milestones => _database?.GetCollection<MilestoneProgress>("milestones_progress");

    private void EnsureIndexes()
    {
        if (_database == null) return;

        // 0. Índice Único por GoogleSub / Email do Usuário e Índice de Filhos por Usuário
        Users?.Indexes.CreateOne(new CreateIndexModel<UserAccount>(
            Builders<UserAccount>.IndexKeys.Ascending(x => x.Email),
            new CreateIndexOptions { Name = "idx_users_email", Unique = true }));

        Babies?.Indexes.CreateOne(new CreateIndexModel<Baby>(
            Builders<Baby>.IndexKeys.Ascending(x => x.OwnerUserId).Ascending(x => x.CreatedAt),
            new CreateIndexOptions { Name = "idx_babies_owner_user" }));

        // 1. Índice Composto por Usuário + Filho + Timestamp para a Timeline Diária
        RoutineEvents?.Indexes.CreateOne(new CreateIndexModel<RoutineEvent>(
            Builders<RoutineEvent>.IndexKeys.Ascending(x => x.OwnerUserId).Ascending(x => x.BabyId).Descending(x => x.Timestamp),
            new CreateIndexOptions { Name = "idx_routine_user_baby_timestamp_desc" }));

        // 2. Índice Composto para Filtro por Categoria e Intervalo de Datas
        RoutineEvents?.Indexes.CreateOne(new CreateIndexModel<RoutineEvent>(
            Builders<RoutineEvent>.IndexKeys.Ascending(x => x.OwnerUserId).Ascending(x => x.BabyId).Ascending(x => x.Category).Descending(x => x.Timestamp),
            new CreateIndexOptions { Name = "idx_routine_user_baby_category_timestamp" }));

        // 3. Índice para Verificação Ativa de Medicações Agudas
        RoutineEvents?.Indexes.CreateOne(new CreateIndexModel<RoutineEvent>(
            Builders<RoutineEvent>.IndexKeys.Ascending(x => x.OwnerUserId).Ascending(x => x.BabyId).Ascending("Details.NextAllowedDoseAt"),
            new CreateIndexOptions { Name = "idx_routine_user_baby_medication_interval" }));

        // 4. Índice para Alérgenos em Monitoramento Ativo (Janela de 72h)
        AllergenTrials?.Indexes.CreateOne(new CreateIndexModel<AllergenTrial>(
            Builders<AllergenTrial>.IndexKeys.Ascending(x => x.OwnerUserId).Ascending(x => x.BabyId).Ascending(x => x.Status).Ascending(x => x.MonitoringEndsAt),
            new CreateIndexOptions { Name = "idx_allergen_user_baby_status_monitoring" }));
    }
}
