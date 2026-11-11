import json
from datetime import datetime
from uuid import uuid4

from pathlib import Path
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from pathlib import Path
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

BASE = Path(__file__).parent
HISTORY_FILE = BASE / "expenses.json"


def load_expenses():
    if not HISTORY_FILE.exists():
        return []

    try:
        with open(HISTORY_FILE, "r", encoding="utf-8") as file:
            return json.load(file)
    except (json.JSONDecodeError, OSError):
        return []


def save_expenses(expenses):
    with open(HISTORY_FILE, "w", encoding="utf-8") as file:
        json.dump(expenses, file, indent=4)
app = FastAPI(title="SplitMate AI")
app.mount("/static", StaticFiles(directory=BASE / "static"), name="static")

class SplitRequest(BaseModel):
    total: float = Field(gt=0)
    members: list[str] = Field(min_length=1)

@app.get("/")
def home():
    return FileResponse(BASE / "static" / "index.html")

@app.post("/api/insights")
def expense_insights(data: dict):
    total = float(data.get("total", 0))
    members = data.get("members", [])
    category = data.get("category", "Other")
    print(f"Selected category: {category}")

    if total <= 0 or not members:
        return {"error": "Please enter a valid expense and members."}

    share = total / len(members)

    category_tips = {
        "Food": "Check the food bill and confirm all items are correct.",
        "Transport": "Compare travel costs and check whether the fare is correct.",
        "Accommodation": "Review room charges and booking costs.",
        "Shopping": "Review individual purchases and keep the receipt.",
        "Entertainment": "Check ticket prices and any additional charges.",
        "Other": "Review the expense details and keep a receipt."
    }

    recommendations = [
        category_tips.get(
            category,
            "Review the expense details and keep a receipt."
        ),
        "Make sure everyone agrees with their contribution.",
        "Keep a copy of the receipt for future reference."
    ]

    return {
        "message": "Expense analysis completed!",
        "total_expense": round(total, 2),
        "member_count": len(members),
        "average_share": round(share, 2),
        "category": category,
        "insight": (
            f"This expense is shared by {len(members)} people. "
            f"Each person should contribute {share:.2f}."
        ),
        "recommendations": recommendations
    }





@app.post("/api/split")
def split_expense(data: SplitRequest):
    names = [name.strip() for name in data.members if name.strip()]
    if not names:
        return {"error": "Add at least one member."}
    # Integer paise/cents allocation prevents rounding drift.
    total_minor = round(data.total * 100)
    base_share, remainder = divmod(total_minor, len(names))
    shares = []
    for i, name in enumerate(names):
        amount = base_share + (1 if i < remainder else 0)
        shares.append({"name": name, "amount": amount / 100})
    return {"total": total_minor / 100, "count": len(names), "shares": shares}

# EXPENSE HISTORY API

@app.post("/api/history")
def add_expense_history(data: dict):

    total = float(data.get("total", 0))
    members = data.get("members", [])
    category = data.get("category", "Other")
    title = data.get("title", "Shared Expense")

    if total <= 0 or not members:
        return {"error": "Invalid expense details."}

    expense = {
        "id": str(uuid4()),
        "title": title,
        "total": round(total, 2),
        "category": category,
        "members": members,
        "member_count": len(members),
        "average_share": round(total / len(members), 2),
        "date": datetime.now().isoformat()
    }

    expenses = load_expenses()
    expenses.append(expense)
    save_expenses(expenses)

    return {
        "message": "Expense saved successfully!",
        "expense": expense
    }


@app.get("/api/history")
def get_expense_history():

    expenses = load_expenses()

    return {
        "total_expenses": len(expenses),
        "expenses": expenses
    }
# DELETE AN EXPENSE FROM HISTORY

@app.delete("/api/history/{expense_id}")
def delete_expense_history(expense_id: str):

    expenses = load_expenses()

    updated_expenses = [
        expense for expense in expenses
        if expense.get("id") != expense_id
    ]

    if len(updated_expenses) == len(expenses):
        return {"error": "Expense not found."}

    save_expenses(updated_expenses)

    return {
        "message": "Expense deleted successfully!"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

# EXPENSE ANALYTICS API

@app.get("/api/analytics")
def get_expense_analytics():

    expenses = load_expenses()

    total_spending = sum(
        float(expense.get("total", 0))
        for expense in expenses
    )

    category_totals = {}

    for expense in expenses:
        category = expense.get("category", "Other")
        amount = float(expense.get("total", 0))

        category_totals[category] = (
            category_totals.get(category, 0) + amount
        )

    highest_expense = max(
        expenses,
        key=lambda expense: float(expense.get("total", 0)),
        default=None
    )

    return {
        "total_spending": round(total_spending, 2),
        "total_transactions": len(expenses),
        "average_expense": round(
            total_spending / len(expenses), 2
        ) if expenses else 0,
        "category_totals": category_totals,
        "highest_expense": highest_expense
    }
# EXPENSE ANALYTICS API

@app.get("/api/analytics")
def get_expense_analytics():

    expenses = load_expenses()

    total_spending = sum(
        float(expense.get("total", 0))
        for expense in expenses
    )

    monthly_totals = {}

    for expense in expenses:
        expense_date = expense.get("date", "")

        if expense_date:
            month = expense_date[:7]
            amount = float(expense.get("total", 0))
            monthly_totals[month] = (
                monthly_totals.get(month, 0) + amount
            )

    category_totals = {}

    for expense in expenses:
        category = expense.get("category", "Other")
        amount = float(expense.get("total", 0))

        category_totals[category] = (
            category_totals.get(category, 0) + amount
        )

    highest_expense = max(
        expenses,
        key=lambda expense: float(expense.get("total", 0)),
        default=None
    )

    return {
        "total_spending": round(total_spending, 2),
        "total_transactions": len(expenses),
        "average_expense": round(
            total_spending / len(expenses), 2
        ) if expenses else 0,
        "monthly_totals": monthly_totals,
        "category_totals": category_totals,
        "highest_expense": highest_expense
    }

