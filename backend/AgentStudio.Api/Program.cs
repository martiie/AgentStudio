using AgentStudio.Api.Hubs;
using AgentStudio.Api.Data;
using AgentStudio.Api.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://localhost:5298");

// Add services to the container.

builder.Services.AddControllers();
builder.Services.AddSignalR();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "http://localhost:4173",
                "http://127.0.0.1:4173")
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
builder.Services.AddSingleton<ClaudeTerminalService>();

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

app.Run("http://localhost:5298");
