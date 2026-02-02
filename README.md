# MeetingOps

MVP de una aplicación que convierte resúmenes de reuniones en Notion en tareas accionables, permite crear tareas desde Slack con `/tasks`, y hace check-ins diarios a las 7pm Chile.

## Features

1. **Ingesta desde Notion** - Lee páginas de una base de datos de reuniones y extrae tareas usando LLM
2. **Slack Bot `/tasks`** - Extrae tareas de conversaciones en Slack
3. **Daily Check-in** - Pregunta a las 7pm Chile qué se completó y actualiza el status de tareas
4. **Editor Visual** - Interfaz tipo n8n para crear y editar workflows con React Flow

## Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + React Flow
- **Backend**: Next.js API Routes
- **Database**: SQLite (Prisma) - fácil migrar a Postgres
- **Integraciones**: Notion API, Slack API (Web API)
- **LLM**: Configurable (OpenAI, Anthropic, o mock para testing)

## Quick Start

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Editar `.env` con tus credenciales:

```env
# Database
DATABASE_URL="file:./dev.db"

# Notion Integration
NOTION_TOKEN="secret_xxx"
NOTION_MEETINGS_DB_ID="your-meetings-database-id"
NOTION_TASKS_DB_ID="your-tasks-database-id"

# Slack App
SLACK_BOT_TOKEN="xoxb-xxx"
SLACK_SIGNING_SECRET="xxx"

# LLM Provider (openai | anthropic | mock)
LLM_PROVIDER="mock"
OPENAI_API_KEY="sk-xxx"        # Si usas OpenAI
ANTHROPIC_API_KEY="sk-ant-xxx"  # Si usas Anthropic

# App Config
APP_URL="http://localhost:3000"
CRON_SECRET="your-random-secret"
```

### 3. Inicializar la base de datos

```bash
npm run db:push
npm run db:seed
```

### 4. Correr en desarrollo

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000)

## Configuración de Notion

### Crear una Integration

1. Ve a [Notion Integrations](https://www.notion.so/my-integrations)
2. Crea una nueva integration
3. Copia el "Internal Integration Secret" → `NOTION_TOKEN`

### Meetings Database

Crear una base de datos con estas propiedades:

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| Name | Title | Título de la reunión |
| Summary | Rich text | Resumen de la reunión (puede ser generado por Notion AI) |
| Date | Date | Fecha de la reunión |

Copiar el ID de la base de datos → `NOTION_MEETINGS_DB_ID`

### Tasks Database

Crear una base de datos con estas propiedades:

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| Name | Title | Título de la tarea |
| Description | Rich text | Descripción detallada |
| OwnerName | Rich text | Persona asignada |
| Status | Select | `Todo`, `Doing`, `Done` |
| SourceUrl | URL | Link al origen (Notion page o Slack) |
| MeetingId | Rich text | ID de la reunión relacionada |
| SlackThread | Rich text | Link al hilo de Slack |

Copiar el ID de la base de datos → `NOTION_TASKS_DB_ID`

**Importante**: Compartir ambas bases de datos con tu integration.

## Configuración de Slack

### Crear una Slack App

1. Ve a [Slack API](https://api.slack.com/apps)
2. Crea una nueva app "From scratch"
3. Nombre: "MeetingOps" (o el que prefieras)

### OAuth & Permissions

Agregar estos Bot Token Scopes:

- `channels:history` - Leer mensajes de canales
- `channels:read` - Ver info de canales
- `chat:write` - Enviar mensajes
- `commands` - Crear slash commands
- `users:read` - Leer info de usuarios

Instalar la app en tu workspace y copiar el Bot Token → `SLACK_BOT_TOKEN`

### Slash Commands

Crear el comando `/tasks`:

- Command: `/tasks`
- Request URL: `https://tu-dominio.com/api/slack/commands`
- Short Description: "Extract tasks from this conversation"
- Usage Hint: (dejar vacío)

### Event Subscriptions (Opcional)

Para capturar respuestas al check-in automáticamente:

1. Enable Events: On
2. Request URL: `https://tu-dominio.com/api/slack/events`
3. Subscribe to bot events:
   - `message.channels`
   - `app_mention`

### Signing Secret

En Basic Information, copiar Signing Secret → `SLACK_SIGNING_SECRET`

## Uso

### Dashboard

Ir a `http://localhost:3000` para ver:
- Estadísticas de workflows y tareas
- Acciones rápidas
- Estado del sistema

### Editor de Workflows

Ir a `/editor` para:
- Crear nuevos workflows arrastrando nodos
- Conectar nodos con edges
- Guardar y ejecutar workflows

### Comando /tasks en Slack

En cualquier canal o hilo de Slack:

```
/tasks
```

El bot:
1. Lee los últimos 20 mensajes (o el hilo completo si está en un thread)
2. Extrae tareas usando LLM
3. Crea las tareas en Notion
4. Publica un resumen en Slack

### Daily Check-in

Configurar canales en `/settings`, luego a las 7pm Chile el bot pregunta:

> "¿Qué completaste hoy? ¿Qué quedó pendiente?"

Las respuestas en el thread se procesan y las tareas mencionadas como completadas se marcan como Done en Notion.

### Cron Jobs

Para el daily check-in, necesitas un cron job que llame:

```bash
# Todos los días a las 7pm Chile (22:00 UTC en verano, 23:00 UTC en invierno)
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://tu-dominio.com/api/scheduler/daily-checkin

# 3 horas después para procesar respuestas
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://tu-dominio.com/api/scheduler/process-responses
```

**Vercel Cron** (si usas Vercel):

Crear `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/scheduler/daily-checkin",
      "schedule": "0 22 * * *"
    },
    {
      "path": "/api/scheduler/process-responses",
      "schedule": "0 1 * * *"
    }
  ]
}
```

## API Endpoints

### Notion

- `GET /api/notion/meetings` - Listar reuniones
- `GET /api/notion/tasks` - Listar tareas
- `POST /api/notion/tasks` - Crear tarea
- `PATCH /api/notion/tasks` - Actualizar status

### Slack

- `POST /api/slack/commands` - Endpoint para slash commands
- `POST /api/slack/events` - Endpoint para eventos
- `GET /api/slack/channels` - Listar canales configurados
- `POST /api/slack/channels` - Agregar canal
- `DELETE /api/slack/channels` - Eliminar canal

### Workflows

- `GET /api/workflows` - Listar workflows
- `POST /api/workflows` - Crear workflow
- `GET /api/workflows/[id]` - Obtener workflow
- `PUT /api/workflows/[id]` - Actualizar workflow
- `DELETE /api/workflows/[id]` - Eliminar workflow
- `POST /api/workflows/[id]/run` - Ejecutar workflow

### Scheduler

- `GET /api/scheduler/daily-checkin` - Trigger manual del check-in
- `GET /api/scheduler/process-responses` - Procesar respuestas

## Formato de Datos

### Task JSON (Output del LLM)

```json
{
  "tasks": [
    {
      "title": "string",
      "description": "string",
      "owner": "string | null",
      "dueDate": "YYYY-MM-DD | null",
      "priority": "low | medium | high | null",
      "source": "notion | slack",
      "sourceUrl": "string | null"
    }
  ]
}
```

### Workflow Definition

```json
{
  "nodes": [
    {
      "id": "unique-id",
      "type": "custom",
      "position": { "x": 100, "y": 100 },
      "data": {
        "label": "Display Name",
        "type": "node_type",
        "config": {}
      }
    }
  ],
  "edges": [
    {
      "id": "edge-id",
      "source": "source-node-id",
      "target": "target-node-id"
    }
  ]
}
```

## Nodos Disponibles

| Tipo | Descripción |
|------|-------------|
| `notion_trigger` | Poll de Notion para nuevas reuniones |
| `llm_extract_tasks` | Extrae tareas de texto usando LLM |
| `notion_create_tasks` | Crea tareas en Notion Tasks DB |
| `slack_command_trigger` | Entry point para /tasks |
| `slack_post_summary` | Publica resumen de tareas en Slack |
| `daily_scheduler` | Trigger para cron (7pm Chile) |
| `slack_ask_update` | Publica mensaje de check-in |
| `task_updater` | Marca tareas como Done |

## Estructura del Proyecto

```
meetingops/
├── prisma/
│   ├── schema.prisma      # Definición de DB
│   └── seed.ts            # Datos iniciales
├── src/
│   ├── app/
│   │   ├── api/           # API Routes
│   │   │   ├── notion/
│   │   │   ├── slack/
│   │   │   ├── workflows/
│   │   │   └── scheduler/
│   │   ├── editor/        # Editor de workflows
│   │   ├── workflows/     # Lista de workflows
│   │   ├── settings/      # Configuración
│   │   └── page.tsx       # Dashboard
│   ├── components/
│   │   └── flow/          # Componentes React Flow
│   └── lib/
│       ├── db.ts          # Cliente Prisma
│       ├── types.ts       # Tipos compartidos
│       ├── notion/        # Cliente Notion
│       ├── slack/         # Cliente Slack
│       ├── llm/           # Cliente LLM
│       └── workflow/      # Runner de workflows
│           ├── runner.ts
│           └── nodes/     # Handlers de nodos
└── .env                   # Variables de entorno
```

## Desarrollo

### Ver base de datos

```bash
npm run db:studio
```

### Reset de base de datos

```bash
npm run db:reset
```

### Build para producción

```bash
npm run build
npm start
```

## Limitaciones del MVP

- No hay autenticación de usuarios
- El LLM mock usa heurísticas simples (configurar OpenAI/Anthropic para mejor extracción)
- No hay reintentos automáticos en caso de fallo
- No hay ejecución paralela de nodos
- El matching de tareas completadas es básico (word overlap)

## TODOs para producción

- [ ] Agregar autenticación (NextAuth)
- [ ] Migrar a Postgres
- [ ] Implementar queue para workflows largos (Bull/BullMQ)
- [ ] Agregar tests
- [ ] Mejorar UI del editor
- [ ] Agregar webhooks de Notion para real-time sync
- [ ] Implementar Socket Mode de Slack para desarrollo local
