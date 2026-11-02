# Stage evidence table (Varshyl merge gate)

| Row | What to paste |
|-----|----------------|
| **CI** | All workflow jobs **pass** on tip SHA |
| **Gitleaks** | Job **pass** or `gitleaks detect --config .gitleaks.toml --source . --log-opts HEAD` → `no leaks found` |
| **Staging tool-JSON** | Live hub/API JSON from staging when applicable |
| **CodeRabbit** | Optional — never a merge blocker |
