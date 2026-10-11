# Frontend Architecture

The Medical Office CRM frontend is an Angular application organized by feature, with separate areas for application-wide infrastructure, reusable UI, and layout components.

The goal is to keep the application modular and maintainable without introducing unnecessary abstractions.

## Project Structure

```text
src/
├── app/
│   ├── core/
│   ├── shared/
│   ├── features/
│   │   └── home/
│   ├── layout/
│   ├── app.config.ts
│   ├── app.routes.ts
│   └── app.ts
├── environments/
│   ├── environment.ts
│   └── environment.development.ts
└── styles.scss
```

### Core

Contains application-wide infrastructure, such as authentication, HTTP interceptors, route guards, and global services.

Core should not contain feature-specific business logic.

### Shared

Contains reusable components, directives, pipes, and utilities that can be used across multiple features.

Shared components should remain independent of specific business features.

### Features

Contains application functionality organized by business domain.

Each feature owns its components, services, models, and routing configuration where appropriate.

Examples of planned features include patients, doctors, appointments, and authentication.

### Layout

Contains application-level presentation components, such as navigation, headers, sidebars, and page shells.

Layout components should not implement business-specific functionality.

## Development Conventions

- Use standalone Angular components.
- Enable strict TypeScript checking.
- Prefer Angular dependency injection for services.
- Use signals for local reactive state when appropriate.
- Keep feature-specific logic within its feature directory.
- Extract components into `shared/` when they are genuinely reusable.
- Use lazy loading for feature routes when appropriate.
- Avoid introducing abstractions before they are needed.

## Environments

Environment configuration is maintained in `src/environments/`.

- `environment.ts` contains production configuration.
- `environment.development.ts` contains local development configuration.

Angular build configurations determine which environment file is used.

Environment files must not contain secrets or sensitive credentials because their contents are bundled into the client application.

## Testing

The frontend uses the Angular CLI testing setup with Vitest.

Build, linting, and unit tests should pass before changes are merged.

```bash
npm run build
npm run lint
npm test -- --watch=false
```

## Architectural Principles

The application favors simple, feature-oriented organization and Angular's built-in capabilities.

Additional libraries, application layers, and abstractions should be introduced only when justified by actual requirements.