using AgentStudio.Api.Hubs;
using AgentStudio.Api.Data;
using AgentStudio.Api.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

var serverUrls = Environment.GetEnvironmentVariable("ASPNETCORE_URLS")
    ?? Environment.GetEnvironmentVariable("DOTNET_URLS")
    ?? builder.Configuration["Server:Urls"];
var serverPort = builder.Configuration.GetValue<int?>("Server:Port") ?? 5298;

builder.WebHost.UseUrls(string.IsNullOrWhiteSpace(serverUrls)
    ? $"http://localhost:{serverPort}"
    : serverUrls);

// Add services to the container.

builder.Services.AddControllers();
builder.Services.AddSignalR();
builder.Services.AddEndpointsApiExplorer();

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? new[]
    {
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173"
    };

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var connectionString = builder.Configuration.GetConnectionString("Postgres")
    ?? "Host=localhost;Port=5432;Database=agentstudio;Username=postgres;Password=postgres";
var databaseProvider = builder.Configuration["DatabaseProvider"] ?? "InMemory";

builder.Services.AddDbContext<AgentStudioDbContext>(options =>
{
    if (string.Equals(databaseProvider, "Postgres", StringComparison.OrdinalIgnoreCase))
    {
        options.UseNpgsql(connectionString);
        return;
    }

    options.UseInMemoryDatabase("agentstudio-local");
});
builder.Services.AddScoped<MarkdownComposer>();
builder.Services.AddSingleton<WorkspaceScannerService>();
builder.Services.AddSingleton<TerminalSessionService>();

var app = builder.Build();

// Configure the HTTP request pipeline.

app.UseCors();
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseAuthorization();

app.MapControllers();
app.MapHub<TerminalHub>("/hubs/terminal");
app.MapFallbackToFile("index.html");

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AgentStudioDbContext>();
    await SeedData.EnsureSeededAsync(dbContext);
}

app.Run();
