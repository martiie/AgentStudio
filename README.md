# Agent Studio

Agent Studio is a beginner-friendly dashboard for managing Claude Code agents, skills, routing rules, project profiles, and generated markdown files.

## Stack

- Frontend: React + TypeScript + Vite
- Backend: ASP.NET Core Web API
- Database: PostgreSQL-ready via EF Core, with an in-memory default for zero-setup local runs

## Run locally

## Build project

Build everything from the project root:

```powershell
.\build.ps1
```

If `frontend/node_modules` is already installed and you want a faster run:

```powershell
.\build.ps1 -SkipFrontendInstall
```

You can also use:

```bat
build.bat
```

## Publish as .exe

Publish the app as a Windows executable bundle from the project root:

```powershell
.\publish.ps1
```

Fast publish when `frontend/node_modules` is already installed:

```powershell
.\publish.ps1 -SkipFrontendInstall
```

This will:

- build the frontend
- copy the frontend output into `backend/AgentStudio.Api/wwwroot`
- publish ASP.NET Core as a Windows `.exe`
- write the result to `publish/AgentStudio`

Run the published app with:

```powershell
.\publish\AgentStudio\AgentStudio.Api.exe
```

Then open:

```text
http://localhost:5298
```

### Backend

```powershell
cd backend/AgentStudio.Api
dotnet run
```

The API starts on `http://localhost:5298`.

To switch from the local in-memory store to PostgreSQL, set `DatabaseProvider` to `Postgres` in `backend/AgentStudio.Api/appsettings.json` and update the `ConnectionStrings:Postgres` value.

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

The app starts on `http://127.0.0.1:5173` and calls the API at `http://localhost:5298/api` by default.

## Main features

- Create, edit, and delete agents
- Create, edit, and delete skills
- Build a central `CLAUDE.md`
- Save project profiles and routing rules
- Preview generated markdown before export
- Copy generated file content and target paths
- Start from built-in templates for common agent roles
