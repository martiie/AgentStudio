using AgentStudio.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using System.Text.Json;

namespace AgentStudio.Api.Data;

public sealed class AgentStudioDbContext(DbContextOptions<AgentStudioDbContext> options) : DbContext(options)
{
    public DbSet<AgentDefinition> Agents => Set<AgentDefinition>();
    public DbSet<SkillDefinition> Skills => Set<SkillDefinition>();
    public DbSet<ProjectProfile> ProjectProfiles => Set<ProjectProfile>();
    public DbSet<RoutingRule> RoutingRules => Set<RoutingRule>();
    public DbSet<GeneratedFileRecord> GeneratedFiles => Set<GeneratedFileRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var stringListConverter = new ValueConverter<List<string>, string>(
            value => JsonSerializer.Serialize(value, JsonSerializerOptions.Default),
            value => JsonSerializer.Deserialize<List<string>>(value, JsonSerializerOptions.Default) ?? new List<string>());
        var stringListComparer = new ValueComparer<List<string>>(
            (left, right) => (left ?? new List<string>()).SequenceEqual(right ?? new List<string>()),
            list => (list ?? new List<string>()).Aggregate(0, (hash, item) => HashCode.Combine(hash, item.GetHashCode())),
            list => list == null ? new List<string>() : list.ToList());

        modelBuilder.Entity<AgentDefinition>(entity =>
        {
            entity.ToTable("agents");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Name).HasMaxLength(120);
            entity.Property(x => x.Role).HasMaxLength(120);
            entity.Property(x => x.ModelPreference).HasMaxLength(120);
            entity.Property(x => x.ToolsAllowed).HasConversion(stringListConverter);
            entity.Property(x => x.ToolsAllowed).Metadata.SetValueComparer(stringListComparer);
            entity.Property(x => x.Tags).HasConversion(stringListConverter);
            entity.Property(x => x.Tags).Metadata.SetValueComparer(stringListComparer);
        });

        modelBuilder.Entity<SkillDefinition>(entity =>
        {
            entity.ToTable("skills");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Name).HasMaxLength(120);
            entity.Property(x => x.Steps).HasConversion(stringListConverter);
            entity.Property(x => x.Steps).Metadata.SetValueComparer(stringListComparer);
            entity.Property(x => x.Examples).HasConversion(stringListConverter);
            entity.Property(x => x.Examples).Metadata.SetValueComparer(stringListComparer);
        });

        modelBuilder.Entity<ProjectProfile>(entity =>
        {
            entity.ToTable("project_profiles");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.ProjectName).HasMaxLength(140);
            entity.Property(x => x.ProjectPath).HasMaxLength(320);
        });

        modelBuilder.Entity<RoutingRule>(entity =>
        {
            entity.ToTable("routing_rules");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Name).HasMaxLength(120);
            entity.HasOne(x => x.Agent)
                .WithMany()
                .HasForeignKey(x => x.AgentId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<GeneratedFileRecord>(entity =>
        {
            entity.ToTable("generated_files");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.FileName).HasMaxLength(200);
            entity.Property(x => x.RelativePath).HasMaxLength(300);
            entity.Property(x => x.FileType).HasMaxLength(60);
        });
    }
}
