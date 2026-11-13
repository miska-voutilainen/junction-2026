# API

<!-- Every endpoint. Kept current by docs-keeper. Or link the generated OpenAPI docs here instead. -->

Base URL: `<production URL>/api`. Errors share one shape: `{ "error": { "code": "...", "message": "..." } }`.

## `<METHOD> /path`

<!-- One line: what it does. -->

**Request**

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| --- | --- | --- | --- |

**Response `200`**

```json
{}
```

**Errors:** `400` invalid input · `404` not found · `429` rate limited · `502` upstream (model or partner API) failed

**Example**

```bash
curl -X <METHOD> "<base>/path" -H "Content-Type: application/json" -d '{}'
```
