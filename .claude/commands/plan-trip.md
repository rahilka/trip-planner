---
description: Plan a budget city trip with the budget-travel-playbook skill and the travel-data MCP server
argument-hint: <destination> <days> <budget-eur> [from <origin>]
---

Plan a trip to **$1** for **$2 days** with a total budget of **€$3**. $ARGUMENTS

1. Load the `budget-travel-playbook` skill and follow it.
2. If the `travel-data` MCP server is connected, use `search_flights`, `search_hotels` and `search_activities` for real (mock) data. Otherwise say clearly which numbers are estimates.
3. The origin is Skopje unless the arguments name another one. If no date is given, use early December and start on the 1st.
4. Answer in the playbook's trip plan format, and end with the budget table and the remaining buffer.
