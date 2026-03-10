---
description: API route conventions — automatically activated for route handler files
globs: ["**/api/**/route.ts", "**/api/**/*.ts", "**/routes/**/*.ts", "**/controllers/**/*.ts"]
---

# API Route Rules

## Structure

- Each route file should only export HTTP method handlers (GET, POST, PUT, DELETE)
- Validate request body with a schema validation library (Zod, Joi, Yup — use what's installed)
- Return meaningful HTTP status codes on errors

## Security

- Check authentication at the beginning of every route
- Specify rate limiting if needed
- Verify CORS settings

## Response Format

```typescript
// Success
return Response.json({ data, message }, { status: 200 });

// Error
return Response.json({ error: "Description" }, { status: 400 });
```

## Documentation

- Every route should have JSDoc documentation
- If Swagger/OpenAPI is installed → add `@swagger` annotations
- Define request/response types explicitly
