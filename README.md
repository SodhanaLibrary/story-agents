# Story Agents 📖

AI-powered story generation system that creates illustrated storybooks using OpenAI's GPT-4 and DALL-E.

## Features

- **Web Application**: Beautiful React UI for creating stories
- **Mobile App**: React Native app for iOS and Android
- **Art Style Intelligence**: AI analyzes your story and recommends the perfect art style, or choose from 11 predefined styles
- **Character Extraction**: Automatically identifies characters and generates detailed avatar descriptions
- **Avatar Generation**: Creates unique character portraits using DALL-E
- **Page Generation**: Breaks down stories into illustrated pages with text and scene descriptions
- **Illustration Generation**: Creates page illustrations based on scene descriptions
- **Cover Generation**: Generates a book cover for your story

## Art Styles

The system supports 11 distinct art styles:

| Style | Description | Best For |
|-------|-------------|----------|
| **Illustration** | Classic children's book style | Children's stories, fairy tales |
| **Cartoon** | Fun, exaggerated with bold colors | Comedy, adventure |
| **Comic** | Western comic book style | Action, superhero |
| **Webtoon** | Korean webtoon style | Romance, drama |
| **Manga** | Japanese manga style | Drama, fantasy |
| **Graphic Novel** | Sophisticated, mature artwork | Literary, noir |
| **Caricature** | Exaggerated features | Comedy, satire |
| **Anime** | Japanese anime aesthetic | Fantasy, magical |
| **Concept Art** | Professional concept art | Sci-fi, world-building |
| **Chibi** | Cute, super-deformed | Kawaii content |
| **Storyboard** | Cinematic style | Action, dramatic |

## Installation

```bash
cd story-agents

# Install all dependencies (backend + web + mobile)
npm run install:all

# Or install separately
npm install
npm run web:install
npm run mobile:install
```

Create a `.env` file with your configuration:
```env
# OpenAI API Configuration
OPENAI_API_KEY=your_key_here
LOG_LEVEL=info  # Options: debug, info, warn, error, silent

# MySQL Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=story_agents
```

### MySQL Database Setup

1. **Install MySQL** if not already installed
2. **Create the database**:
```bash
mysql -u root -p < database/schema.sql
```

Or manually create the database:
```sql
CREATE DATABASE story_agents CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

The application will automatically create tables on first start.

Create a `web/.env` file for Google OAuth:
```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

**To get a Google Client ID:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project or select existing one
3. Go to Credentials > Create Credentials > OAuth 2.0 Client ID
4. Application type: Web application
5. Add authorized JavaScript origins:
   - `http://localhost:3000` (development)
   - Your production domain
6. Copy the Client ID to your `.env` file

## Usage

### Web Application (Recommended)

Start both the server and web app:

```bash
# Terminal 1: Start the API server
npm run server

# Terminal 2: Start the web app
npm run web
```

Then open http://localhost:3000 in your browser.

**Web App Features:**
1. Write your story or use a sample
2. AI analyzes and recommends art style
3. Choose from 11 styles or let AI decide
4. Watch real-time generation progress
5. View illustrated pages and character avatars
6. Download story data

### Mobile App (iOS/Android)

```bash
# Terminal 1: Start the API server
npm run server

# Terminal 2: Start the mobile app
npm run mobile
```

Scan the QR code with Expo Go app on your device, or:

```bash
# iOS Simulator (Mac only)
npm run mobile:ios

# Android Emulator
npm run mobile:android
```

**Note**: For physical devices, update the API URL in `mobile/src/services/api.ts` with your computer's IP address.

### CLI Mode

```bash
# Interactive story generation
npm run generate

# View all available art styles
npm run generate -- --styles
```

### Programmatic Usage

```javascript
import { createStoryGenerator, generateStory } from './src/index.js';

// Auto-detect best style
const result = await generateStory(myStory);

// Use specific style
const result = await generateStory(myStory, { artStyleKey: 'manga' });

// Custom style
const result = await generateStory(myStory, { 
  artStyle: 'watercolor, dreamy, soft colors' 
});
```

## Project Structure

```
story-agents/
├── src/
│   ├── agents/           # AI agents
│   │   ├── artStyleAgent.js
│   │   ├── characterAgent.js
│   │   ├── avatarAgent.js
│   │   ├── pageAgent.js
│   │   ├── illustrationAgent.js
│   │   └── storyOrchestrator.js
│   ├── services/
│   │   ├── openai.js
│   │   ├── database.js   # MySQL connection pool
│   │   └── storyRepository.js  # Story CRUD operations
│   └── utils/
│       ├── storage.js    # Image file storage
│       └── logger.js
├── server/
│   └── index.js          # Express API server
├── database/
│   └── schema.sql        # MySQL database schema
├── web/                  # React web app
│   └── src/
│       ├── App.jsx
│       └── components/
├── mobile/               # React Native mobile app
│   ├── App.tsx
│   └── src/
│       ├── screens/
│       ├── components/
│       ├── services/
│       └── theme/
├── storage/              # Image files only
│   ├── avatars/
│   └── pages/
└── package.json
```

## Data Storage

- **MySQL Database**: Stores all story data (stories, characters, pages, drafts, users)
- **File Storage**: Only image files (avatars, page illustrations) are stored on disk

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/styles` | GET | Get all available art styles |
| `/api/analyze-style` | POST | Analyze story and get style recommendation |
| `/api/generate` | POST | Start story generation job |
| `/api/job/:jobId` | GET | Get job status and result |
| `/api/health` | GET | Health check |

## Screenshots

### Story Input
Write your story or choose from samples. Set number of pages.

### Style Selection
AI recommendation with confidence score. 11 art styles to choose from.

### Generation Progress
Real-time progress tracking with phase indicators.

### Story Viewer
Browse illustrated pages, view character avatars, download story data.

## Logging

The application includes a comprehensive logging system with support for different log levels.

### Log Levels

| Level | Description |
|-------|-------------|
| `debug` | Detailed debugging info (API calls, token counts) |
| `info` | General operational info (default) |
| `warn` | Warning messages |
| `error` | Error messages only |
| `silent` | No logging |

### Configuration

Set the log level via environment variable:
```bash
# In .env file
LOG_LEVEL=debug

# Or when starting server
LOG_LEVEL=debug npm run server
```

### Programmatic Usage

```javascript
import { createLogger } from './src/utils/logger.js';

const logger = createLogger('MyModule');

logger.debug('Detailed info');
logger.info('General info');
logger.warn('Warning message');
logger.error('Error occurred');
logger.success('Operation completed');
logger.step(1, 5, 'Processing step 1');
logger.section('New Section');
logger.json('Data object:', { key: 'value' });
logger.prompt('API Call', messages, { model: 'gpt-4o' });
```

## API Costs

- **GPT-4o-mini**: ~$0.15/1M input, ~$0.60/1M output tokens
- **DALL-E 3**: ~$0.04-0.08 per image

A typical 6-page story costs approximately $1-3 USD.

## License

MIT
