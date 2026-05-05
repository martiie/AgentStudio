using System.Text.Json;
using AgentStudio.Api.Dtos;

namespace AgentStudio.Api.Services;

public sealed class WorkspaceScannerService
{
    public WorkspaceScanResultDto Scan(string directoryPath)
    {
        var normalizedPath = directoryPath.Trim();
        if (string.IsNullOrWhiteSpace(normalizedPath))
        {
            throw new InvalidOperationException("Directory path is required.");
        }

        if (!Directory.Exists(normalizedPath))
        {
            throw new DirectoryNotFoundException($"Directory does not exist: {normalizedPath}");
        }

        var root = new DirectoryInfo(normalizedPath);
        var notes = new List<string>();

        var agentsDirectory = ResolveDirectory(root, ".claude", "agents")
            ?? ResolveDirectory(root, "agents");
        var skillsDirectory = ResolveDirectory(root, ".claude", "skills")
            ?? ResolveDirectory(root, "skills");

        if (agentsDirectory is null)
        {
            notes.Add("No dedicated agents directory was found. Expected `.claude/agents` or `agents`.");
        }

        if (skillsDirectory is null)
        {
            notes.Add("No dedicated skills directory was found. Expected `.claude/skills` or `skills`.");
        }

        var agents = ScanMarkdownFiles(root.FullName, agentsDirectory, "agent");
        var skills = ScanMarkdownFiles(root.FullName, skillsDirectory, "skill");

        var detectedTech = DetectTechStack(root);
        var folderStructure = BuildFolderStructure(root);
        var importantCommands = BuildImportantCommands(root, detectedTech);
        var parsedClaude = ParseClaudeFile(root);

        return new WorkspaceScanResultDto(
            root.FullName,
            ToTitle(root.Name),
            string.Join(", ", detectedTech),
            folderStructure,
            importantCommands,
            agents,
            skills,
            notes,
            parsedClaude);
    }

    private static DirectoryInfo? ResolveDirectory(DirectoryInfo root, params string[] segments)
    {
        var combined = Path.Combine([root.FullName, .. segments]);
        return Directory.Exists(combined) ? new DirectoryInfo(combined) : null;
    }

    private static List<DetectedWorkspaceItemDto> ScanMarkdownFiles(string rootPath, DirectoryInfo? directory, string kind)
    {
        if (directory is null)
        {
            return [];
        }

        return directory.GetFiles("*.md", SearchOption.TopDirectoryOnly)
            .Where(file => !string.Equals(file.Name, "README.md", StringComparison.OrdinalIgnoreCase))
            .OrderBy(file => file.Name)
            .Select(file =>
            {
                var content = File.ReadAllText(file.FullName);
                var parsed = ParseMarkdownContent(content, kind);

                return new DetectedWorkspaceItemDto(
                    file.Name,
                    file.FullName,
                    Path.GetRelativePath(rootPath, file.FullName),
                    parsed.Name ?? ToTitle(Path.GetFileNameWithoutExtension(file.Name)),
                    kind,
                    content,
                    parsed.Role,
                    parsed.Description,
                    parsed.ModelPreference,
                    parsed.ToolsAllowed,
                    parsed.Instructions,
                    parsed.Tags,
                    parsed.Purpose,
                    parsed.TriggerCondition,
                    parsed.Steps,
                    parsed.Examples);
            })
            .ToList();
    }

    private static ParsedWorkspaceMarkdown ParseMarkdownContent(string content, string kind)
    {
        var lines = content.Replace("\r\n", "\n").Split('\n');
        var parsed = new ParsedWorkspaceMarkdown();
        string? currentSection = null;
        var sectionBuffer = new List<string>();

        void CommitSection()
        {
            if (string.IsNullOrWhiteSpace(currentSection))
            {
                return;
            }

            var sectionText = string.Join('\n', sectionBuffer).Trim();
            switch (currentSection)
            {
                case "Description":
                    parsed.Description = sectionText;
                    break;
                case "Model Preference":
                    parsed.ModelPreference = sectionText;
                    break;
                case "Allowed Tools":
                    parsed.ToolsAllowed = ExtractBullets(sectionBuffer);
                    break;
                case "Instructions":
                    parsed.Instructions = sectionText;
                    break;
                case "Tags":
                    parsed.Tags = sectionText
                        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                        .ToList();
                    break;
                case "Purpose":
                    parsed.Purpose = sectionText;
                    break;
                case "Trigger Condition":
                    parsed.TriggerCondition = sectionText;
                    break;
                case "Steps":
                    parsed.Steps = ExtractBullets(sectionBuffer);
                    break;
                case "Examples":
                    parsed.Examples = ExtractBullets(sectionBuffer);
                    break;
            }
        }

        foreach (var rawLine in lines)
        {
            var line = rawLine.TrimEnd();
            if (string.IsNullOrWhiteSpace(line))
            {
                if (!string.IsNullOrWhiteSpace(currentSection))
                {
                    sectionBuffer.Add(string.Empty);
                }
                continue;
            }

            if (line.StartsWith("# "))
            {
                parsed.Name = line[2..].Trim();
                continue;
            }

            if (kind == "agent" && line.StartsWith("**Role:**", StringComparison.OrdinalIgnoreCase))
            {
                parsed.Role = line["**Role:**".Length..].Trim();
                continue;
            }

            if (line.StartsWith("## "))
            {
                CommitSection();
                currentSection = line[3..].Trim();
                sectionBuffer.Clear();
                continue;
            }

            sectionBuffer.Add(line);
        }

        CommitSection();
        return parsed;
    }

    private static List<string> ExtractBullets(IEnumerable<string> lines) =>
        lines
            .Select(line => line.Trim())
            .Where(line => line.StartsWith("- "))
            .Select(line => line[2..].Trim())
            .Where(line => !string.IsNullOrWhiteSpace(line))
            .ToList();

    private static List<string> DetectTechStack(DirectoryInfo root)
    {
        var detected = new List<string>();

        if (File.Exists(Path.Combine(root.FullName, "package.json")))
        {
            detected.Add("Node.js");

            if (TryReadPackageJson(root.FullName, out var packageTech))
            {
                detected.AddRange(packageTech);
            }
        }

        if (Directory.GetFiles(root.FullName, "*.sln", SearchOption.TopDirectoryOnly).Length > 0 ||
            Directory.GetFiles(root.FullName, "*.csproj", SearchOption.AllDirectories).Length > 0)
        {
            detected.Add("ASP.NET Core");
        }

        if (File.Exists(Path.Combine(root.FullName, "requirements.txt")) ||
            File.Exists(Path.Combine(root.FullName, "pyproject.toml")))
        {
            detected.Add("Python");
        }

        if (File.Exists(Path.Combine(root.FullName, "docker-compose.yml")) ||
            File.Exists(Path.Combine(root.FullName, "docker-compose.yaml")) ||
            File.Exists(Path.Combine(root.FullName, "Dockerfile")))
        {
            detected.Add("Docker");
        }

        return detected.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
    }

    private static bool TryReadPackageJson(string rootPath, out List<string> packageTech)
    {
        packageTech = [];
        var packageJsonPath = Path.Combine(rootPath, "package.json");

        try
        {
            using var document = JsonDocument.Parse(File.ReadAllText(packageJsonPath));
            if (!document.RootElement.TryGetProperty("dependencies", out var deps) &&
                !document.RootElement.TryGetProperty("devDependencies", out deps))
            {
                return false;
            }

            var keys = deps.EnumerateObject().Select(property => property.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
            if (keys.Contains("react"))
            {
                packageTech.Add("React");
            }

            if (keys.Contains("vite"))
            {
                packageTech.Add("Vite");
            }

            if (keys.Contains("typescript"))
            {
                packageTech.Add("TypeScript");
            }

            return packageTech.Count > 0;
        }
        catch
        {
            return false;
        }
    }

    private static string BuildFolderStructure(DirectoryInfo root)
    {
        var directories = root.GetDirectories()
            .OrderBy(dir => dir.Name)
            .Select(dir => $"/{dir.Name}")
            .ToList();

        if (directories.Count == 0)
        {
            return $"/{root.Name}";
        }

        return string.Join('\n', directories);
    }

    private static string BuildImportantCommands(DirectoryInfo root, List<string> detectedTech)
    {
        var commands = new List<string>();

        if (File.Exists(Path.Combine(root.FullName, "package.json")))
        {
            commands.Add("npm run dev");
            commands.Add("npm run build");
        }

        if (detectedTech.Contains("ASP.NET Core", StringComparer.OrdinalIgnoreCase))
        {
            commands.Add("dotnet run");
        }

        if (detectedTech.Contains("Python", StringComparer.OrdinalIgnoreCase))
        {
            commands.Add("python app.py");
        }

        return commands.Count == 0
            ? "Add the commands your team uses most often."
            : string.Join('\n', commands.Distinct(StringComparer.OrdinalIgnoreCase));
    }

    private static string ToTitle(string value)
    {
        var parts = value
            .Replace('-', ' ')
            .Replace('_', ' ')
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        return string.Join(' ', parts.Select(part =>
            part.Length == 0
                ? part
                : char.ToUpperInvariant(part[0]) + part[1..]));
    }

    private static ParsedClaudeWorkspaceDto? ParseClaudeFile(DirectoryInfo root)
    {
        var claudePath = Path.Combine(root.FullName, "CLAUDE.md");
        if (!File.Exists(claudePath))
        {
            return null;
        }

        var lines = File.ReadAllLines(claudePath);
        string? currentSection = null;
        string? currentSubSection = null;
        var buffer = new List<string>();
        string? projectName = null;
        string? techStack = null;
        string? codingRules = null;
        string? folderStructure = null;
        string? importantCommands = null;
        var activeAgents = new List<string>();
        var activeSkills = new List<string>();
        var routingRules = new List<ParsedClaudeRoutingRuleDto>();

        void CommitBuffer()
        {
            if (string.IsNullOrWhiteSpace(currentSection))
            {
                return;
            }

            var text = string.Join('\n', buffer).Trim();
            if (currentSection == "Project Context")
            {
                if (buffer.Count > 0)
                {
                    foreach (var line in buffer.Select(x => x.Trim()))
                    {
                        if (line.StartsWith("**Project:**", StringComparison.OrdinalIgnoreCase))
                        {
                            projectName = line["**Project:**".Length..].Trim();
                        }
                        else if (line.StartsWith("**Tech Stack:**", StringComparison.OrdinalIgnoreCase))
                        {
                            techStack = line["**Tech Stack:**".Length..].Trim();
                        }
                    }
                }

                switch (currentSubSection)
                {
                    case "Coding Rules":
                        codingRules = text;
                        break;
                    case "Folder Structure":
                        folderStructure = text;
                        break;
                    case "Important Commands":
                        importantCommands = text;
                        break;
                }
            }
            else if (currentSection == "Active Agents")
            {
                activeAgents = ExtractBoldList(buffer);
            }
            else if (currentSection == "Active Skills")
            {
                activeSkills = ExtractBoldList(buffer);
            }
            else if (currentSection == "Routing Rules")
            {
                routingRules = ExtractRoutingRules(buffer);
            }
        }

        foreach (var rawLine in lines)
        {
            var line = rawLine.TrimEnd();
            if (line.StartsWith("## "))
            {
                CommitBuffer();
                currentSection = line[3..].Trim();
                currentSubSection = null;
                buffer.Clear();
                continue;
            }

            if (line.StartsWith("### "))
            {
                CommitBuffer();
                currentSubSection = line[4..].Trim();
                buffer.Clear();
                continue;
            }

            buffer.Add(line);
        }

        CommitBuffer();

        return new ParsedClaudeWorkspaceDto(
            Path.GetRelativePath(root.FullName, claudePath),
            projectName,
            techStack,
            codingRules,
            folderStructure,
            importantCommands,
            activeAgents,
            activeSkills,
            routingRules);
    }

    private static List<string> ExtractBoldList(IEnumerable<string> lines) =>
        lines
            .Select(line => line.Trim())
            .Where(line => line.StartsWith("- **") && line.Contains("**:"))
            .Select(line =>
            {
                var start = line.IndexOf("**", StringComparison.Ordinal) + 2;
                var end = line.IndexOf("**:", StringComparison.Ordinal);
                return start >= 2 && end > start ? line[start..end].Trim() : string.Empty;
            })
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .ToList();

    private static List<ParsedClaudeRoutingRuleDto> ExtractRoutingRules(IEnumerable<string> lines)
    {
        var items = new List<ParsedClaudeRoutingRuleDto>();

        foreach (var rawLine in lines.Select(x => x.Trim()))
        {
            if (string.IsNullOrWhiteSpace(rawLine))
            {
                continue;
            }

            var dotIndex = rawLine.IndexOf('.');
            var ifIndex = rawLine.IndexOf("If ", StringComparison.OrdinalIgnoreCase);
            var arrowIndex = rawLine.IndexOf("->", StringComparison.OrdinalIgnoreCase);
            if (dotIndex <= 0 || ifIndex < 0 || arrowIndex < 0 || arrowIndex <= ifIndex)
            {
                continue;
            }

            if (!int.TryParse(rawLine[..dotIndex], out var priority))
            {
                continue;
            }

            var condition = rawLine[(ifIndex + 3)..arrowIndex].Trim();
            var target = rawLine[(arrowIndex + 2)..].Trim();
            if (!string.IsNullOrWhiteSpace(condition) && !string.IsNullOrWhiteSpace(target))
            {
                items.Add(new ParsedClaudeRoutingRuleDto(priority, condition, target));
            }
        }

        return items;
    }

    private sealed class ParsedWorkspaceMarkdown
    {
        public string? Name { get; set; }
        public string? Role { get; set; }
        public string? Description { get; set; }
        public string? ModelPreference { get; set; }
        public List<string> ToolsAllowed { get; set; } = [];
        public string? Instructions { get; set; }
        public List<string> Tags { get; set; } = [];
        public string? Purpose { get; set; }
        public string? TriggerCondition { get; set; }
        public List<string> Steps { get; set; } = [];
        public List<string> Examples { get; set; } = [];
    }
}
