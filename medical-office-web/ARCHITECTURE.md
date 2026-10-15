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

### Frontend Testing Conventions

The frontend uses Angular's `TestBed` with Vitest for unit and component testing.

Tests are colocated with their implementation files using the `.spec.ts` suffix.

Testing guidelines:

- **Components:** Test observable behavior, including rendered content, inputs, outputs, and user interactions.
- **Signal inputs:** Use `fixture.componentRef.setInput()` to update component inputs in tests.
- **Content projection:** Use a host component when testing projected content and interactions with the parent.
- **HTTP services:** Use `provideHttpClient()` and `provideHttpClientTesting()` with `HttpTestingController` to verify requests, responses, and error handling.
- **Routing:** Use Angular's router testing utilities to verify navigation, redirects, and route guards.
- **Authentication:** Mock OIDC dependencies and verify application behavior without contacting a real authentication server.
- **Mocking:** Use Vitest mocks when isolating external dependencies or observing interactions.
- **Accessibility:** Verify relevant semantic HTML, accessible names, and ARIA attributes. Use real-browser testing for behavior that jsdom cannot simulate reliably.
- **Test isolation:** Avoid shared mutable state between tests. Reset mocks and verify outstanding HTTP requests where appropriate.

Tests should remain focused, deterministic, and independent of external services.

Run the following checks before committing or opening a pull request:

```bash
npm test -- --watch=false
npm run lint
npm run build
```

New frontend features should include focused tests for their relevant behavior.

## Architectural Principles

The application favors simple, feature-oriented organization and Angular's built-in capabilities.

Additional libraries, application layers, and abstractions should be introduced only when justified by actual requirements.