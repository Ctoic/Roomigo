import os
from io import BytesIO
from datetime import datetime
from calendar import month_name

from flask import Flask, jsonify, request, send_file, Blueprint
from flask_cors import CORS
from flask_login import (
    LoginManager,
    login_user,
    login_required,
    logout_user,
    current_user,
)
from flask_bcrypt import Bcrypt
from flask_migrate import Migrate
from flask_wtf.csrf import generate_csrf
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from sqlalchemy import extract
import pandas as pd

# Models / DB
from models import (
    db,
    Student,
    Room,
    Expense,
    Issue,
    Admin,
    FeeRecord,
    Employee,
    SalaryRecord,
    HostelRegistration,
)

# -----------------------------
# Configuration & Extensions
# -----------------------------

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "your_secret_key")
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", "sqlite:///hostel.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = os.environ.get("UPLOAD_FOLDER", "static/uploads")
    PERMANENT_SESSION_LIFETIME = 1800  # 30 minutes
    WTF_CSRF_ENABLED = False
    WTF_CSRF_SECRET_KEY = os.environ.get("WTF_CSRF_SECRET_KEY", "your_csrf_secret_key")

# Initialize extensions once (application-factory friendly)
_bcrypt = Bcrypt()
_login_manager = LoginManager()
_migrate = Migrate()


def allowed_file(filename: str) -> bool:
    ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "xlsx", "xls"}
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def get_student_month_paid(student_id: int, year: int, month: int) -> float:
    records = FeeRecord.query.filter(
        FeeRecord.student_id == student_id,
        extract("month", FeeRecord.date_paid) == month,
        extract("year", FeeRecord.date_paid) == year,
    ).all()
    return float(sum(record.amount for record in records))


def get_quick_fee_status(total_paid: float, monthly_fee: float) -> str:
    return "paid" if total_paid >= monthly_fee else "not_paid"


# -----------------------------
# Application Factory
# -----------------------------

def create_app(config_class: type = Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_class)

    # CORS (kept behavior but centralized here)
    CORS(
        app,
        origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"],
        supports_credentials=True,
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=[
            "Content-Type",
            "Authorization",
            "X-Requested-With",
            "X-CSRF-Token",
            "X-CSRFToken",
        ],
        expose_headers=["Content-Type", "X-CSRF-Token", "X-CSRFToken"],
        credentials=True,
    )

    # Init extensions
    db.init_app(app)
    _bcrypt.init_app(app)
    _login_manager.init_app(app)
    _migrate.init_app(app, db)
    _login_manager.login_view = "auth.api_login"

    @_login_manager.user_loader
    def load_user(user_id):
        return Admin.query.get(int(user_id))

    @_login_manager.unauthorized_handler
    def unauthorized():
        return jsonify({"success": False, "message": "Authentication required"}), 401

    # Register blueprints
    app.register_blueprint(main_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(rooms_bp)
    app.register_blueprint(expenses_bp)
    app.register_blueprint(fees_bp)
    app.register_blueprint(students_api_bp)
    app.register_blueprint(legacy_bp)
    app.register_blueprint(employees_bp)
    app.register_blueprint(salaries_bp)
    app.register_blueprint(registration_bp)

    # Basic JSON error handlers (optional best-practice)
    @app.errorhandler(404)
    def not_found(_):
        return jsonify({"success": False, "message": "Not found"}), 404

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({"success": False, "message": str(e)}), 500

    if not os.environ.get("FLASK_SKIP_BOOTSTRAP"):
        with app.app_context():
            bootstrap_data()

    return app


# -----------------------------
# Data bootstrapping
# -----------------------------

def bootstrap_data():
    """Create initial tables, rooms, and employees (idempotent)."""
    db.create_all()

    # Create 14 rooms with 3 seats (rooms 1-14)
    for i in range(1, 15):
        if not Room.query.filter_by(room_number=i).first():
            room = Room(room_number=i, capacity=3)
            db.session.add(room)

    # Create 4 rooms with 4 seats (rooms 15-18)
    for i in range(15, 19):
        if not Room.query.filter_by(room_number=i).first():
            room = Room(room_number=i, capacity=4)
            db.session.add(room)

    # Initial employees
    if not Employee.query.filter_by(name="M Bilal").first():
        db.session.add(Employee(name="M Bilal", position="Manager", base_salary=50000))
    if not Employee.query.filter_by(name="Ishfaq Hussain").first():
        db.session.add(Employee(name="Ishfaq Hussain", position="Cook", base_salary=30000))
    if not Employee.query.filter_by(name="Abdul Waheed").first():
        db.session.add(Employee(name="Abdul Waheed", position="Cook", base_salary=20000))

    db.session.commit()


# -----------------------------
# Blueprints: Main & Auth
# -----------------------------

main_bp = Blueprint("main", __name__)
auth_bp = Blueprint("auth", __name__)


@main_bp.route("/")
def root():
    return jsonify({"message": "Hostel Management System API", "status": "success"})


@main_bp.route("/test")
def test():
    return jsonify({"message": "Flask server is running!", "status": "success"})


@main_bp.route("/health")
def health():
    return jsonify({"status": "healthy", "message": "Server is running on port 5051"})


@main_bp.route("/api/csrf-token")
def get_csrf_token():
    return jsonify({"csrf_token": generate_csrf()})


@auth_bp.route("/login", methods=["POST"])
def api_login():
    try:
        data = request.get_json()
        admin = Admin.query.filter_by(username=data["username"]).first()

        if admin and _bcrypt.check_password_hash(admin.password_hash, data["password"]):
            login_user(admin)
            return jsonify(
                {
                    "success": True,
                    "user": {
                        "id": admin.id,
                        "name": admin.name,
                        "email": admin.email,
                        "username": admin.username,
                    },
                }
            )
        else:
            return jsonify({"success": False, "message": "Invalid credentials"}), 401

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@auth_bp.route("/check-auth")
def check_auth():
    if current_user.is_authenticated:
        return jsonify(
            {
                "success": True,
                "user": {
                    "id": current_user.id,
                    "name": current_user.name,
                    "email": current_user.email,
                    "username": current_user.username,
                },
            }
        )
    return jsonify({"success": False, "message": "Not authenticated"}), 401


@auth_bp.route("/logout", methods=["POST"])
@login_required
def logout():
    logout_user()
    return jsonify({"success": True, "message": "Logged out successfully"})


# -----------------------------
# Blueprints: Dashboard & Rooms
# -----------------------------

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/api")
rooms_bp = Blueprint("rooms", __name__, url_prefix="/api")


@dashboard_bp.route("/dashboard")
@login_required
def api_dashboard():
    try:
        current_year = datetime.now().year
        current_month = datetime.now().month

        # Total active students
        total_students = Student.query.filter_by(status="active").count()

        monthly_expenses = []
        monthly_income = []
        months = []

        for i in range(5, -1, -1):
            month = current_month - i
            year = current_year
            if month <= 0:
                month += 12
                year -= 1

            # Expenses for month
            month_expenses = Expense.query.filter(
                db.extract("year", Expense.date) == year,
                db.extract("month", Expense.date) == month,
            ).all()
            total_expense = sum(expense.price for expense in month_expenses)

            # Income for month
            month_income = FeeRecord.query.filter(
                db.extract("year", FeeRecord.date_paid) == year,
                db.extract("month", FeeRecord.date_paid) == month,
            ).all()
            total_income = sum(record.amount for record in month_income)

            monthly_expenses.append(total_expense)
            monthly_income.append(total_income)
            months.append(month_name[month][:3])

        # Expense categories (pie chart)
        expense_categories = (
            db.session.query(Expense.item_name, db.func.sum(Expense.price).label("total"))
            .group_by(Expense.item_name)
            .all()
        )

        current_month_expenses = sum(monthly_expenses[-1:])
        current_month_income = sum(monthly_income[-1:])
        profit_loss = current_month_income - current_month_expenses

        fully_paid = (
            Student.query.filter_by(status="active").filter(Student.fee_status == "paid").count()
        )
        partially_paid = (
            Student.query.filter_by(status="active").filter(Student.fee_status == "partial").count()
        )
        unpaid = (
            Student.query.filter_by(status="active").filter(Student.fee_status == "unpaid").count()
        )

        current_month_year = f"{current_year:04d}-{current_month:02d}"
        current_month_salaries = SalaryRecord.query.filter_by(month_year=current_month_year).all()
        total_salaries_current = sum(record.amount_paid for record in current_month_salaries)

        prev_month = current_month - 1 if current_month > 1 else 12
        prev_year = current_year if current_month > 1 else current_year - 1
        prev_month_year = f"{prev_year:04d}-{prev_month:02d}"
        prev_month_salaries = SalaryRecord.query.filter_by(month_year=prev_month_year).all()
        total_salaries_previous = sum(record.amount_paid for record in prev_month_salaries)

        return jsonify(
            {
                "total_students": total_students,
                "monthly_expenses": monthly_expenses,
                "monthly_income": monthly_income,
                "months": months,
                "expense_categories": [
                    {"item_name": cat[0], "total": float(cat[1])} for cat in expense_categories
                ],
                "current_month_expenses": current_month_expenses,
                "current_month_income": current_month_income,
                "profit_loss": profit_loss,
                "fully_paid": fully_paid,
                "partially_paid": partially_paid,
                "unpaid": unpaid,
                "total_salaries_current": total_salaries_current,
                "total_salaries_previous": total_salaries_previous,
            }
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@rooms_bp.route("/rooms")
@login_required
def api_rooms():
    try:
        rooms = Room.query.all()
        rooms_data = []
        for room in rooms:
            try:
                room_data = {
                    "id": room.id,
                    "room_number": room.room_number,
                    "capacity": room.capacity,
                    "current_occupancy": len(room.students) if room.students else 0,
                    "students": [],
                }

                if room.students:
                    for student in room.students:
                        student_data = {
                            "id": student.id,
                            "name": student.name,
                            "picture": student.picture if student.picture else None,
                        }
                        room_data["students"].append(student_data)

                rooms_data.append(room_data)
            except Exception as room_error:
                print(f"Error processing room {room.id}: {str(room_error)}")
                continue

        return jsonify({"rooms": rooms_data})
    except Exception as e:
        print(f"Error in api_rooms: {str(e)}")
        return jsonify({"error": str(e)}), 500


@rooms_bp.route("/rooms/availability")
@login_required
def api_rooms_availability():
    try:
        rooms = Room.query.all()
        total_rooms = len(rooms)
        available_rooms = 0
        by_capacity = {}

        for room in rooms:
            capacity = int(room.capacity or 0)
            current_occupancy = len(room.students) if room.students else 0
            has_vacancy = current_occupancy < capacity
            if has_vacancy:
                available_rooms += 1

            if capacity not in by_capacity:
                by_capacity[capacity] = {"total": 0, "available": 0}
            by_capacity[capacity]["total"] += 1
            if has_vacancy:
                by_capacity[capacity]["available"] += 1

        rooms_by_type = [
            {"type": f"{capacity}-seater", "total": data["total"], "available": data["available"]}
            for capacity, data in sorted(by_capacity.items())
        ]

        return jsonify(
            {
                "rooms_total": total_rooms,
                "rooms_available": available_rooms,
                "rooms_occupied": total_rooms - available_rooms,
                "rooms_by_type": rooms_by_type,
            }
        )
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# -----------------------------
# Blueprints: Expenses & Fees
# -----------------------------

expenses_bp = Blueprint("expenses", __name__, url_prefix="/api")
fees_bp = Blueprint("fees", __name__, url_prefix="/api")


@expenses_bp.route("/expenses", methods=["GET", "POST", "DELETE"])
@login_required
def api_expenses():
    try:
        if request.method == "GET":
            month = request.args.get("month", datetime.now().month, type=int)
            year = request.args.get("year", datetime.now().year, type=int)

            prev_month = month - 1 if month > 1 else 12
            prev_year = year if month > 1 else year - 1

            expenses_current = (
                Expense.query.filter(extract("year", Expense.date) == year, extract("month", Expense.date) == month)
                .order_by(Expense.date.desc())
                .all()
            )

            expenses_previous = (
                Expense.query.filter(
                    extract("year", Expense.date) == prev_year, extract("month", Expense.date) == prev_month
                )
                .order_by(Expense.date.desc())
                .all()
            )

            total_expenses_current = sum(expense.price for expense in expenses_current)
            total_expenses_previous = sum(expense.price for expense in expenses_previous)

            fee_records_current = FeeRecord.query.filter(
                extract("year", FeeRecord.date_paid) == year, extract("month", FeeRecord.date_paid) == month
            ).all()
            total_income_current = sum(record.amount for record in fee_records_current)

            fee_records_previous = FeeRecord.query.filter(
                extract("year", FeeRecord.date_paid) == prev_year,
                extract("month", FeeRecord.date_paid) == prev_month,
            ).all()
            total_income_previous = sum(record.amount for record in fee_records_previous)

            remaining_balance_current = total_income_current - total_expenses_current
            remaining_balance_previous = total_income_previous - total_expenses_previous

            return jsonify(
                {
                    "expenses_current": [
                        {
                            "id": e.id,
                            "item_name": e.item_name,
                            "price": e.price,
                            "date": e.date.strftime("%Y-%m-%d"),
                            "user_id": e.user_id,
                        }
                        for e in expenses_current
                    ],
                    "expenses_previous": [
                        {
                            "id": e.id,
                            "item_name": e.item_name,
                            "price": e.price,
                            "date": e.date.strftime("%Y-%m-%d"),
                            "user_id": e.user_id,
                        }
                        for e in expenses_previous
                    ],
                    "total_expenses_current": total_expenses_current,
                    "total_expenses_previous": total_expenses_previous,
                    "total_income_current": total_income_current,
                    "total_income_previous": total_income_previous,
                    "remaining_balance_current": remaining_balance_current,
                    "remaining_balance_previous": remaining_balance_previous,
                    "current_month": month,
                    "current_year": year,
                    "prev_month": prev_month,
                    "prev_year": prev_year,
                }
            )

        elif request.method == "POST":
            data = request.get_json()
            if not data:
                return jsonify({"success": False, "message": "No data provided"}), 400

            required_fields = ["item_name", "price", "date"]
            missing_fields = [field for field in required_fields if field not in data]
            if missing_fields:
                return (
                    jsonify({"success": False, "message": f"Missing required fields: {', '.join(missing_fields)}"}),
                    400,
                )

            try:
                try:
                    price = float(data["price"])
                    if price <= 0:
                        return jsonify({"success": False, "message": "Price must be greater than 0"}), 400
                except ValueError:
                    return jsonify({"success": False, "message": "Price must be a valid number"}), 400

                try:
                    date = datetime.strptime(data["date"], "%Y-%m-%d")
                except ValueError:
                    return jsonify({"success": False, "message": "Invalid date format. Use YYYY-MM-DD"}), 400

                expense = Expense(item_name=data["item_name"], price=price, date=date, user_id=current_user.id)
                db.session.add(expense)
                db.session.commit()
                return jsonify(
                    {
                        "success": True,
                        "message": "Expense added successfully!",
                        "expense": {
                            "id": expense.id,
                            "item_name": expense.item_name,
                            "price": expense.price,
                            "date": expense.date.strftime("%Y-%m-%d"),
                            "user_id": expense.user_id,
                        },
                    }
                )
            except Exception as e:
                db.session.rollback()
                return jsonify({"success": False, "message": f"Error adding expense: {str(e)}"}), 400

        elif request.method == "DELETE":
            expense_id = request.args.get("id", type=int)
            if not expense_id:
                return jsonify({"success": False, "message": "No expense ID provided"}), 400

            expense = Expense.query.get_or_404(expense_id)
            db.session.delete(expense)
            db.session.commit()
            return jsonify({"success": True, "message": "Expense deleted successfully!"})

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@expenses_bp.route("/export_pdf/<int:year>/<int:month>")
@login_required
def export_pdf(year, month):
    try:
        expenses = Expense.query.filter(extract("year", Expense.date) == year, extract("month", Expense.date) == month).all()

        buffer = BytesIO()
        p = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4

        p.setFont("Helvetica-Bold", 16)
        p.drawString(50, height - 50, f"Expenses Report - {month_name[month]} {year}")

        p.setFont("Helvetica-Bold", 12)
        p.drawString(50, height - 100, "Item")
        p.drawString(200, height - 100, "Price")
        p.drawString(300, height - 100, "Date")

        y_position = height - 120
        p.setFont("Helvetica", 10)
        total = 0

        for expense in expenses:
            if y_position < 50:
                p.showPage()
                y_position = height - 50
                p.setFont("Helvetica-Bold", 12)
                p.drawString(50, height - 50, f"Expenses Report - {month_name[month]} {year} (Continued)")
                p.setFont("Helvetica", 10)
                y_position = height - 70

            p.drawString(50, y_position, expense.item_name)
            p.drawString(200, y_position, f"Rs.{expense.price:.2f}")
            p.drawString(300, y_position, expense.date.strftime("%Y-%m-%d"))
            total += expense.price
            y_position -= 20

        p.setFont("Helvetica-Bold", 12)
        p.drawString(50, y_position - 20, f"Total: Rs.{total:.2f}")

        p.showPage()
        p.save()

        buffer.seek(0)
        return send_file(
            buffer,
            as_attachment=True,
            download_name=f"expenses_{month_name[month]}_{year}.pdf",
            mimetype="application/pdf",
        )

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@fees_bp.route("/fees")
@login_required
def api_fees():
    try:
        month = request.args.get("month", datetime.now().month, type=int)
        year = request.args.get("year", datetime.now().year, type=int)

        prev_month = month - 1 if month > 1 else 12
        prev_year = year if month > 1 else year - 1

        fee_records_current = (
            FeeRecord.query.filter(extract("year", FeeRecord.date_paid) == year, extract("month", FeeRecord.date_paid) == month)
            .order_by(FeeRecord.date_paid.desc())
            .all()
        )
        fee_records_previous = (
            FeeRecord.query.filter(
                extract("year", FeeRecord.date_paid) == prev_year, extract("month", FeeRecord.date_paid) == prev_month
            )
            .order_by(FeeRecord.date_paid.desc())
            .all()
        )

        total_fees_current = sum(record.amount for record in fee_records_current)
        total_fees_previous = sum(record.amount for record in fee_records_previous)

        monthly_totals = []
        for m in range(1, 13):
            month_total = (
                FeeRecord.query.filter(extract("year", FeeRecord.date_paid) == year, extract("month", FeeRecord.date_paid) == m)
                .with_entities(db.func.sum(FeeRecord.amount))
                .scalar()
                or 0
            )
            monthly_totals.append({"month": datetime(2000, m, 1).strftime("%B"), "total": month_total})

        return jsonify(
            {
                "fee_records_current": [
                    {
                        "id": record.id,
                        "student_id": record.student_id,
                        "amount": record.amount,
                        "date_paid": record.date_paid.strftime("%Y-%m-%d"),
                        "student": {
                            "id": record.student.id,
                            "name": record.student.name,
                            "fee_status": record.student.fee_status,
                            "room_number": record.student.room_number,
                        },
                    }
                    for record in fee_records_current
                ],
                "fee_records_previous": [
                    {
                        "id": record.id,
                        "student_id": record.student_id,
                        "amount": record.amount,
                        "date_paid": record.date_paid.strftime("%Y-%m-%d"),
                        "student": {
                            "id": record.student.id,
                            "name": record.student.name,
                            "fee_status": record.student.fee_status,
                            "room_number": record.student.room_number,
                        },
                    }
                    for record in fee_records_previous
                ],
                "total_fees_current": total_fees_current,
                "total_fees_previous": total_fees_previous,
                "current_month": month,
                "current_year": year,
                "prev_month": prev_month,
                "prev_year": prev_year,
                "monthly_totals": monthly_totals,
            }
        )

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@fees_bp.route("/fees/quick-collection", methods=["GET", "POST"])
@login_required
def quick_fee_collection():
    try:
        if request.method == "GET":
            month = request.args.get("month", datetime.now().month, type=int)
            year = request.args.get("year", datetime.now().year, type=int)

            if month < 1 or month > 12:
                return jsonify({"success": False, "message": "Month must be between 1 and 12"}), 400

            active_students = Student.query.filter_by(status="active").order_by(Student.name.asc()).all()
            students_data = []
            for student in active_students:
                total_paid = get_student_month_paid(student.id, year, month)
                students_data.append(
                    {
                        "id": student.id,
                        "name": student.name,
                        "room_number": student.room_number,
                        "monthly_fee": float(student.fee),
                        "collected_amount": float(total_paid),
                        "remaining_amount": max(0.0, float(student.fee) - float(total_paid)),
                        "status": get_quick_fee_status(total_paid, float(student.fee)),
                    }
                )

            return jsonify(
                {
                    "success": True,
                    "month": month,
                    "year": year,
                    "students": students_data,
                }
            )

        data = request.get_json() or {}
        student_id = data.get("student_id")
        status = data.get("status")
        month = int(data.get("month", datetime.now().month))
        year = int(data.get("year", datetime.now().year))

        if not student_id or status not in {"paid", "not_paid"}:
            return jsonify({"success": False, "message": "student_id and valid status are required"}), 400
        if month < 1 or month > 12:
            return jsonify({"success": False, "message": "Month must be between 1 and 12"}), 400

        student = Student.query.get_or_404(int(student_id))
        if student.status != "active":
            return jsonify({"success": False, "message": "Only active students can be updated"}), 400

        month_records = FeeRecord.query.filter(
            FeeRecord.student_id == student.id,
            extract("month", FeeRecord.date_paid) == month,
            extract("year", FeeRecord.date_paid) == year,
        ).all()
        total_paid = float(sum(record.amount for record in month_records))

        if status == "paid":
            amount_to_add = max(0.0, float(student.fee) - total_paid)
            if amount_to_add > 0:
                payment_date = datetime(year, month, 1).date()
                db.session.add(
                    FeeRecord(
                        student_id=student.id,
                        amount=amount_to_add,
                        date_paid=payment_date,
                        month_year=f"{year:04d}-{month:02d}",
                        payment_method="cash",
                    )
                )
                student.last_fee_payment = datetime.utcnow()
        else:
            for record in month_records:
                db.session.delete(record)

        current_month = datetime.now().month
        current_year = datetime.now().year
        if month == current_month and year == current_year:
            current_month_total = get_student_month_paid(student.id, current_year, current_month)
            if current_month_total >= student.fee:
                student.fee_status = "paid"
            elif current_month_total > 0:
                student.fee_status = "partial"
            else:
                student.fee_status = "unpaid"

        db.session.commit()

        updated_total = get_student_month_paid(student.id, year, month)
        return jsonify(
            {
                "success": True,
                "message": "Fee status updated successfully",
                "student": {
                    "id": student.id,
                    "name": student.name,
                    "room_number": student.room_number,
                    "monthly_fee": float(student.fee),
                    "collected_amount": float(updated_total),
                    "remaining_amount": max(0.0, float(student.fee) - float(updated_total)),
                    "status": get_quick_fee_status(updated_total, float(student.fee)),
                },
            }
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


# -----------------------------
# Blueprints: Students (API) & Legacy non-API routes
# -----------------------------

students_api_bp = Blueprint("students_api", __name__, url_prefix="/api")
legacy_bp = Blueprint("legacy", __name__)


@students_api_bp.route("/students", methods=["GET", "POST"])
@login_required
def api_students():
    try:
        if request.method == "GET":
            # --- Pagination params ---
            page = request.args.get("page", 1, type=int)
            per_page = request.args.get("per_page", 10, type=int)
            # clamp per_page to sane bounds
            if per_page <= 0:
                per_page = 10
            per_page = min(per_page, 100)

            # Base query (customize filters/sorting here if needed)
            query = Student.query
            total = query.count()

            students = (
                query.order_by(Student.id.desc())
                .limit(per_page)
                .offset((page - 1) * per_page)
                .all()
            )

            students_data = [
                {
                    "id": student.id,
                    "name": student.name,
                    "fee": student.fee,
                    "room_id": student.room_id,
                    "room_number": student.room_number,
                    "status": student.status,
                    "picture": student.picture,
                    "fee_status": student.fee_status,
                    "remaining_fee": student.remaining_fee,
                }
                for student in students
            ]

            total_pages = (total + per_page - 1) // per_page
            meta = {
                "page": page,
                "per_page": per_page,
                "total": total,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_prev": page > 1,
            }

            return jsonify({"students": students_data, "meta": meta})

        elif request.method == "POST":
            data = request.get_json()

            if not data.get("name") or not data.get("fee") or not data.get("room_id"):
                return jsonify({"error": "Name, fee, and room_id are required"}), 400

            room_id = int(data["room_id"])
            if room_id < 1 or room_id > 18:
                return jsonify({"error": "Room ID must be between 1 and 18"}), 400

            room = Room.query.get(room_id)
            if not room:
                return jsonify({"error": f"Room {room_id} not found"}), 404

            if len(room.students) >= room.capacity:
                return jsonify({"error": f"Room {room_id} is at full capacity ({room.capacity} students)"}), 400

            new_student = Student(name=data["name"], fee=data["fee"], room_id=data["room_id"], status="active")
            db.session.add(new_student)
            db.session.commit()

            return (
                jsonify(
                    {
                        "success": True,
                        "message": "Student enrolled successfully",
                        "student": {
                            "id": new_student.id,
                            "name": new_student.name,
                            "fee": new_student.fee,
                            "room_id": new_student.room_id,
                            "status": new_student.status,
                        },
                    }
                ),
                201,
            )

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@students_api_bp.route("/students/<int:student_id>", methods=["PUT", "DELETE"])
@login_required
def api_update_student(student_id):
    try:
        student = Student.query.get_or_404(student_id)

        if request.method == "DELETE":
            try:
                fee_records = FeeRecord.query.filter_by(student_id=student_id).all()
                for fee_record in fee_records:
                    db.session.delete(fee_record)
                db.session.delete(student)
                db.session.commit()
                return jsonify({"success": True, "message": "Student deleted successfully"})
            except Exception as e:
                db.session.rollback()
                print(f"Error deleting student: {str(e)}")
                return jsonify({"error": "Failed to delete student due to database constraints"}), 500

        data = request.get_json()
        if "name" in data:
            student.name = data["name"]
        if "fee" in data:
            student.fee = data["fee"]
        if "room_id" in data:
            room_id = int(data["room_id"])
            if room_id < 1 or room_id > 18:
                return jsonify({"error": "Room ID must be between 1 and 18"}), 400
            new_room = Room.query.get(room_id)
            if not new_room:
                return jsonify({"error": f"Room {room_id} not found"}), 404
            if student.room_id != room_id:
                if len(new_room.students) >= new_room.capacity:
                    return jsonify({"error": f"Room {room_id} is at full capacity ({new_room.capacity} students)"}), 400
            student.room_id = room_id
        if "status" in data:
            student.status = data["status"]

        db.session.commit()
        return jsonify({"success": True, "message": "Student updated successfully"})

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# Legacy (non-API) routes preserved
@legacy_bp.route("/students")
@login_required
def get_students():
    try:
        # Pagination for legacy endpoint
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 20, type=int)
        if per_page <= 0:
            per_page = 20
        per_page = min(per_page, 100)

        query = Student.query
        total = query.count()
        students = (
            query.order_by(Student.id.desc())
            .limit(per_page)
            .offset((page - 1) * per_page)
            .all()
        )

        students_payload = [
            {
                "id": student.id,
                "name": student.name,
                "email": student.email,
                "phone": student.phone,
                "room_number": student.room_number,
                "status": student.status,
                "fee_status": student.fee_status,
                "picture": student.picture,
                "fee": student.fee,
                "remaining_fee": student.remaining_fee,
            }
            for student in students
        ]

        total_pages = (total + per_page - 1) // per_page
        meta = {
            "page": page,
            "per_page": per_page,
            "total": total,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1,
        }

        return jsonify({"students": students_payload, "meta": meta})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@legacy_bp.route("/enroll", methods=["POST"])
@login_required
def enroll_student():
    try:
        data = request.get_json()
        new_student = Student(
            name=data["name"],
            email=data["email"],
            phone=data["phone"],
            room_number=data["room_number"],
            status="active",
            fee_status="unpaid",
        )
        db.session.add(new_student)
        db.session.commit()
        return jsonify({"success": True, "message": "Student enrolled successfully"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

@students_api_bp.route("/students/bulk-upload", methods=["POST"])
@login_required
def bulk_upload_students():
    """Upload an Excel file (.xlsx/.xls) with columns: name, fee, room_id."""
    try:
        if "file" not in request.files:
            return jsonify({"success": False, "message": "No file part in the request"}), 400

        file = request.files["file"]
        if file.filename == "":
            return jsonify({"success": False, "message": "No file selected"}), 400

        if not allowed_file(file.filename):
            return jsonify({
                "success": False,
                "message": "Invalid file type. Please upload an Excel file (.xlsx or .xls)"
            }), 400

        try:
            # Read Excel into DataFrame
            df = pd.read_excel(file)
        except Exception as e:
            return jsonify({"success": False, "message": f"Unable to read Excel file: {str(e)}"}), 400

        # Normalize columns
        df.columns = [str(c).strip().lower() for c in df.columns]
        required = {"name", "fee", "room_id"}
        if not required.issubset(df.columns):
            return jsonify({
                "success": False,
                "message": "Missing required columns. Required: name, fee, room_id"
            }), 400

        total_processed = 0
        success_count = 0
        errors = []
        seen_names = set()

        # Process rows one-by-one so partial successes persist
        for idx, row in df.iterrows():
            row_num = idx + 2  # header is row 1
            total_processed += 1

            try:
                # Name
                name = str(row.get("name", "")).strip()
                if not name or name.lower() == "nan":
                    raise ValueError("name is required")
                if name in seen_names:
                    raise ValueError("duplicate name within file")
                if Student.query.filter_by(name=name).first():
                    raise ValueError("student with this name already exists")

                # Fee
                try:
                    fee = float(row.get("fee", None))
                except Exception:
                    raise ValueError("fee must be a number")
                if fee <= 0:
                    raise ValueError("fee must be greater than 0")

                # Room
                try:
                    room_id = int(row.get("room_id", None))
                except Exception:
                    raise ValueError("room_id must be an integer")
                if room_id < 1 or room_id > 18:
                    raise ValueError("room_id must be between 1 and 18")

                room = Room.query.get(room_id)
                if not room:
                    raise ValueError(f"room {room_id} not found")

                # Capacity check
                current_occupancy = len(room.students) if room.students else 0
                if current_occupancy >= room.capacity:
                    raise ValueError(f"room {room_id} is full (capacity {room.capacity})")

                # Create
                student = Student(name=name, fee=fee, room_id=room_id, status="active")
                db.session.add(student)
                db.session.commit()

                success_count += 1
                seen_names.add(name)

            except Exception as row_err:
                db.session.rollback()
                errors.append(f"Row {row_num}: {str(row_err)}")
                continue

        summary = {
            "total_processed": total_processed,
            "success_count": success_count,
            "error_count": len(errors),
            "errors": errors,
        }

        if success_count == 0:
            message = "No students were added. Please review the errors."
        elif len(errors) == 0:
            message = f"Successfully added {success_count} student(s)."
        else:
            message = f"Added {success_count} student(s) with {len(errors)} error(s)."

        return jsonify({"success": True, "message": message, "summary": summary})

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


@students_api_bp.route("/students/download-template", methods=["GET"])
@login_required
def download_students_template():
    """Provide an Excel template for bulk upload."""
    try:
        example = pd.DataFrame({
            "name": ["Ali Khan", "Sara Ahmed"],
            "fee": [5000, 5500],
            "room_id": [1, 2],
        })

        output = BytesIO()
        try:
            with pd.ExcelWriter(output, engine="openpyxl") as writer:
                example.to_excel(writer, index=False, sheet_name="students")
            mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            filename = "student_bulk_upload_template.xlsx"
        except Exception:
            # Fallback to CSV if openpyxl isn't installed
            output = BytesIO()
            output.write(example.to_csv(index=False).encode("utf-8"))
            mime = "text/csv"
            filename = "student_bulk_upload_template.csv"

        output.seek(0)
        return send_file(output, as_attachment=True, download_name=filename, mimetype=mime)
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
        
@legacy_bp.route("/collect-fee", methods=["POST"])
@login_required
def collect_fee():
    try:
        data = request.get_json()
        if not data.get("student_id") or not data.get("amount") or not data.get("date"):
            return jsonify({"success": False, "message": "Student ID, amount, and date are required"}), 400

        fee_record = FeeRecord(
            student_id=data["student_id"],
            amount=data["amount"],
            date_paid=datetime.strptime(data["date"], "%Y-%m-%d"),
            month_year=datetime.strptime(data["date"], "%Y-%m-%d").strftime("%Y-%m"),
            payment_method="cash",
        )
        db.session.add(fee_record)

        student = Student.query.get(data["student_id"])
        if student:
            current_month = datetime.strptime(data["date"], "%Y-%m-%d").month
            current_year = datetime.strptime(data["date"], "%Y-%m-%d").year
            month_fee_records = FeeRecord.query.filter(
                FeeRecord.student_id == data["student_id"],
                extract("month", FeeRecord.date_paid) == current_month,
                extract("year", FeeRecord.date_paid) == current_year,
            ).all()
            total_paid = sum(record.amount for record in month_fee_records)
            if total_paid >= student.fee:
                student.fee_status = "paid"
            elif total_paid > 0:
                student.fee_status = "partial"
            else:
                student.fee_status = "unpaid"
            student.last_fee_payment = datetime.strptime(data["date"], "%Y-%m-%d")

        db.session.commit()
        return jsonify({"success": True, "message": "Fee collected successfully"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


@legacy_bp.route("/fee-records")
@login_required
def get_fee_records():
    try:
        records = FeeRecord.query.all()
        return jsonify(
            {
                "fee_records": [
                    {
                        "id": record.id,
                        "student_id": record.student_id,
                        "amount": record.amount,
                        "date_paid": record.date_paid.strftime("%Y-%m-%d"),
                        "payment_method": record.payment_method,
                        "student": {
                            "id": record.student.id,
                            "name": record.student.name,
                            "fee_status": record.student.fee_status,
                            "room_number": record.student.room_number,
                        },
                    }
                    for record in records
                ]
            }
        )
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# -----------------------------------
# Blueprints: Employees & Salaries
# ---------------------------------

employees_bp = Blueprint("employees", __name__, url_prefix="/api")
salaries_bp = Blueprint("salaries", __name__, url_prefix="/api")


@employees_bp.route("/employees", methods=["GET"])
@login_required
def get_employees():
    try:
        employees = Employee.query.all()
        employee_list = []
        for employee in employees:
            current_month = datetime.now().month
            current_year = datetime.now().year
            month_year = f"{current_year:04d}-{current_month:02d}"
            salary_paid = SalaryRecord.query.filter_by(employee_id=employee.id, month_year=month_year).first()
            employee_data = {
                "id": employee.id,
                "name": employee.name,
                "position": employee.position,
                "base_salary": employee.base_salary,
                "hire_date": employee.hire_date.strftime("%Y-%m-%d"),
                "status": employee.status,
                "current_month_salary_paid": salary_paid.amount_paid if salary_paid else 0,
                "current_month_salary_status": "paid" if salary_paid else "unpaid",
            }
            employee_list.append(employee_data)
        return jsonify({"success": True, "employees": employee_list})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@employees_bp.route("/employees", methods=["POST"])
@login_required
def add_employee():
    try:
        data = request.get_json()
        if not all(key in data for key in ["name", "position", "base_salary"]):
            return jsonify({"success": False, "message": "Missing required fields"}), 400
        employee = Employee(name=data["name"], position=data["position"], base_salary=float(data["base_salary"]))
        db.session.add(employee)
        db.session.commit()
        return jsonify({"success": True, "message": "Employee added successfully", "employee_id": employee.id})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


@employees_bp.route("/employees/<int:employee_id>", methods=["PUT"])
@login_required
def update_employee(employee_id):
    try:
        employee = Employee.query.get_or_404(employee_id)
        data = request.get_json()
        if "name" in data:
            employee.name = data["name"]
        if "position" in data:
            employee.position = data["position"]
        if "base_salary" in data:
            employee.base_salary = float(data["base_salary"])
        if "status" in data:
            employee.status = data["status"]
        db.session.commit()
        return jsonify({"success": True, "message": "Employee updated successfully"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


@employees_bp.route("/employees/<int:employee_id>", methods=["DELETE"])
@login_required
def delete_employee(employee_id):
    try:
        employee = Employee.query.get_or_404(employee_id)
        salary_records = SalaryRecord.query.filter_by(employee_id=employee_id).all()
        for salary_record in salary_records:
            db.session.delete(salary_record)
        db.session.delete(employee)
        db.session.commit()
        return jsonify({"success": True, "message": "Employee deleted successfully"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


@salaries_bp.route("/employees/<int:employee_id>/salaries", methods=["GET"])
@login_required
def get_employee_salaries(employee_id):
    try:
        employee = Employee.query.get_or_404(employee_id)
        salary_records = (
            SalaryRecord.query.filter_by(employee_id=employee_id).order_by(SalaryRecord.month_year.desc()).all()
        )
        salary_list = []
        for record in salary_records:
            salary_list.append(
                {
                    "id": record.id,
                    "month_year": record.month_year,
                    "amount_paid": record.amount_paid,
                    "date_paid": record.date_paid.strftime("%Y-%m-%d"),
                    "payment_method": record.payment_method,
                    "notes": record.notes,
                }
            )
        return jsonify(
            {
                "success": True,
                "employee": {
                    "id": employee.id,
                    "name": employee.name,
                    "position": employee.position,
                    "base_salary": employee.base_salary,
                },
                "salary_records": salary_list,
            }
        )
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@salaries_bp.route("/employees/<int:employee_id>/salaries", methods=["POST"])
@login_required
def add_salary_payment(employee_id):
    try:
        employee = Employee.query.get_or_404(employee_id)
        data = request.get_json()
        if not all(key in data for key in ["month_year", "amount_paid"]):
            return jsonify({"success": False, "message": "Missing required fields"}), 400

        existing_payment = SalaryRecord.query.filter_by(employee_id=employee_id, month_year=data["month_year"]).first()
        if existing_payment:
            return jsonify({"success": False, "message": "Salary already paid for this month"}), 400

        salary_record = SalaryRecord(
            employee_id=employee_id,
            month_year=data["month_year"],
            amount_paid=float(data["amount_paid"]),
            payment_method=data.get("payment_method", "cash"),
            notes=data.get("notes", ""),
        )
        db.session.add(salary_record)

        year, month = data["month_year"].split("-")
        expense_date = datetime(int(year), int(month), 1)
        admin_user_id = current_user.id
        salary_expense = Expense(
            item_name=f"Salary paid to {employee.name} ({employee.position})",
            price=float(data["amount_paid"]),
            date=expense_date,
            user_id=admin_user_id,
        )
        db.session.add(salary_expense)
        db.session.commit()

        return jsonify({"success": True, "message": "Salary payment recorded successfully"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


@salaries_bp.route("/salaries/<int:salary_id>", methods=["PUT"])
@login_required
def update_salary_payment(salary_id):
    try:
        salary_record = SalaryRecord.query.get_or_404(salary_id)
        data = request.get_json()
        if "amount_paid" in data:
            salary_record.amount_paid = float(data["amount_paid"])
        if "payment_method" in data:
            salary_record.payment_method = data["payment_method"]
        if "notes" in data:
            salary_record.notes = data["notes"]
        db.session.commit()
        return jsonify({"success": True, "message": "Salary payment updated successfully"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


@salaries_bp.route("/salaries/<int:salary_id>", methods=["DELETE"])
@login_required
def delete_salary_payment(salary_id):
    try:
        salary_record = SalaryRecord.query.get_or_404(salary_id)
        expense_name = f"Salary paid to {salary_record.employee.name} ({salary_record.employee.position})"
        corresponding_expense = Expense.query.filter_by(
            item_name=expense_name, price=salary_record.amount_paid, user_id=current_user.id
        ).first()
        if corresponding_expense:
            db.session.delete(corresponding_expense)
        db.session.delete(salary_record)
        db.session.commit()
        return jsonify({"success": True, "message": "Salary payment deleted successfully"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


@salaries_bp.route("/salaries/summary/<month_year>", methods=["GET"])
@login_required
def get_monthly_salary_summary(month_year):
    try:
        salary_records = SalaryRecord.query.filter_by(month_year=month_year).all()
        total_paid = sum(record.amount_paid for record in salary_records)
        total_employees = Employee.query.filter_by(status="active").count()
        paid_employees = len(salary_records)
        unpaid_employees = total_employees - paid_employees

        summary = {
            "month_year": month_year,
            "total_paid": total_paid,
            "total_employees": total_employees,
            "paid_employees": paid_employees,
            "unpaid_employees": unpaid_employees,
            "payments": [],
        }
        for record in salary_records:
            summary["payments"].append(
                {
                    "employee_name": record.employee.name,
                    "position": record.employee.position,
                    "amount_paid": record.amount_paid,
                    "date_paid": record.date_paid.strftime("%Y-%m-%d"),
                    "payment_method": record.payment_method,
                }
            )
        return jsonify({"success": True, "summary": summary})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@salaries_bp.route("/salaries/yearly-summary/<int:year>", methods=["GET"])
@login_required
def get_yearly_salary_summary(year):
    try:
        salary_records = SalaryRecord.query.filter(SalaryRecord.month_year.like(f"{year}-%")).all()
        monthly_summary = {}
        for i in range(1, 13):
            month_key = f"{year:04d}-{i:02d}"
            monthly_summary[month_key] = {"month": month_key, "total_paid": 0, "employee_count": 0, "payments": []}

        for record in salary_records:
            month_key = record.month_year
            if month_key in monthly_summary:
                monthly_summary[month_key]["total_paid"] += record.amount_paid
                monthly_summary[month_key]["employee_count"] += 1
                monthly_summary[month_key]["payments"].append(
                    {
                        "employee_name": record.employee.name,
                        "position": record.employee.position,
                        "amount_paid": record.amount_paid,
                        "date_paid": record.date_paid.strftime("%Y-%m-%d"),
                    }
                )

        monthly_list = list(monthly_summary.values())
        monthly_list.sort(key=lambda x: x["month"])
        yearly_total = sum(month["total_paid"] for month in monthly_list)
        total_employees = Employee.query.filter_by(status="active").count()

        summary = {
            "year": year,
            "yearly_total": yearly_total,
            "total_employees": total_employees,
            "monthly_breakdown": monthly_list,
        }

        return jsonify({"success": True, "summary": summary})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@salaries_bp.route("/salaries/available-months", methods=["GET"])
@login_required
def get_available_salary_months():
    try:
        month_years = (
            db.session.query(SalaryRecord.month_year).distinct().order_by(SalaryRecord.month_year.desc()).all()
        )
        years = (
            db.session.query(db.func.substr(SalaryRecord.month_year, 1, 4).label("year"))
            .distinct()
            .order_by(db.func.substr(SalaryRecord.month_year, 1, 4).desc())
            .all()
        )
        available_months = [month[0] for month in month_years]
        available_years = [year[0] for year in years]
        return jsonify({"success": True, "available_months": available_months, "available_years": available_years})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# -----------------------------
# Blueprint: Registration
# -----------------------------

registration_bp = Blueprint("registration", __name__, url_prefix="/api")


@registration_bp.route("/registration", methods=["POST"])
def submit_registration():
    """Submit a new hostel registration request (public endpoint)"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = [
            "name", "email", "phone", "address", "emergency_contact", 
            "emergency_contact_name", "university", "course", "year_of_study", "expected_duration"
        ]
        missing_fields = [field for field in required_fields if not data.get(field)]
        if missing_fields:
            return jsonify({
                "success": False, 
                "message": f"Missing required fields: {', '.join(missing_fields)}"
            }), 400
        
        # Check if email already exists
        existing_registration = HostelRegistration.query.filter_by(email=data["email"]).first()
        if existing_registration:
            return jsonify({
                "success": False, 
                "message": "A registration with this email already exists"
            }), 400
        
        # Create new registration
        registration = HostelRegistration(
            name=data["name"],
            email=data["email"],
            phone=data["phone"],
            address=data["address"],
            emergency_contact=data["emergency_contact"],
            emergency_contact_name=data["emergency_contact_name"],
            university=data["university"],
            course=data["course"],
            year_of_study=data["year_of_study"],
            expected_duration=data["expected_duration"],
            special_requirements=data.get("special_requirements", ""),
            status="pending"
        )
        
        db.session.add(registration)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Registration submitted successfully! We will contact you soon.",
            "registration_id": registration.id
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


@registration_bp.route("/admin/registrations", methods=["GET"])
@login_required
def get_registrations():
    """Get all registration requests (admin only)"""
    try:
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 10, type=int)
        status_filter = request.args.get("status", "all")
        
        # Clamp per_page to sane bounds
        if per_page <= 0:
            per_page = 10
        per_page = min(per_page, 100)
        
        # Build query
        query = HostelRegistration.query
        if status_filter != "all":
            query = query.filter_by(status=status_filter)
        
        total = query.count()
        registrations = (
            query.order_by(HostelRegistration.submitted_at.desc())
            .limit(per_page)
            .offset((page - 1) * per_page)
            .all()
        )
        
        registrations_data = []
        for reg in registrations:
            admin_user = Admin.query.get(reg.contacted_by) if reg.contacted_by else None
            registrations_data.append({
                "id": reg.id,
                "name": reg.name,
                "email": reg.email,
                "phone": reg.phone,
                "address": reg.address,
                "emergency_contact": reg.emergency_contact,
                "emergency_contact_name": reg.emergency_contact_name,
                "university": reg.university,
                "course": reg.course,
                "year_of_study": reg.year_of_study,
                "expected_duration": reg.expected_duration,
                "special_requirements": reg.special_requirements,
                "status": reg.status,
                "submitted_at": reg.submitted_at.strftime("%Y-%m-%d %H:%M:%S"),
                "admin_notes": reg.admin_notes,
                "contacted_at": reg.contacted_at.strftime("%Y-%m-%d %H:%M:%S") if reg.contacted_at else None,
                "contacted_by": admin_user.name if admin_user else None
            })
        
        total_pages = (total + per_page - 1) // per_page
        meta = {
            "page": page,
            "per_page": per_page,
            "total": total,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1,
        }
        
        return jsonify({"registrations": registrations_data, "meta": meta})
        
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@registration_bp.route("/admin/registrations/<int:registration_id>", methods=["PUT"])
@login_required
def update_registration_status(registration_id):
    """Update registration status and add admin notes (admin only)"""
    try:
        registration = HostelRegistration.query.get_or_404(registration_id)
        data = request.get_json()
        
        if "status" in data:
            valid_statuses = ["pending", "contacted", "approved", "rejected"]
            if data["status"] not in valid_statuses:
                return jsonify({
                    "success": False, 
                    "message": f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
                }), 400
            registration.status = data["status"]
            
            # Update contacted info if status is being changed to contacted
            if data["status"] == "contacted":
                registration.contacted_at = datetime.utcnow()
                registration.contacted_by = current_user.id
        
        if "admin_notes" in data:
            registration.admin_notes = data["admin_notes"]
        
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Registration updated successfully"
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


@registration_bp.route("/admin/registrations/<int:registration_id>", methods=["DELETE"])
@login_required
def delete_registration(registration_id):
    """Delete a registration request (admin only)"""
    try:
        registration = HostelRegistration.query.get_or_404(registration_id)
        db.session.delete(registration)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Registration deleted successfully"
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


@registration_bp.route("/admin/registrations/stats", methods=["GET"])
@login_required
def get_registration_stats():
    """Get registration statistics (admin only)"""
    try:
        total_registrations = HostelRegistration.query.count()
        pending_count = HostelRegistration.query.filter_by(status="pending").count()
        contacted_count = HostelRegistration.query.filter_by(status="contacted").count()
        approved_count = HostelRegistration.query.filter_by(status="approved").count()
        rejected_count = HostelRegistration.query.filter_by(status="rejected").count()
        
        # Recent registrations (last 7 days)
        from datetime import timedelta
        week_ago = datetime.utcnow() - timedelta(days=7)
        recent_count = HostelRegistration.query.filter(
            HostelRegistration.submitted_at >= week_ago
        ).count()
        
        return jsonify({
            "total_registrations": total_registrations,
            "pending_count": pending_count,
            "contacted_count": contacted_count,
            "approved_count": approved_count,
            "rejected_count": rejected_count,
            "recent_count": recent_count
        })
        
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# -----------------------------
# Entrypoint
# -----------------------------

if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        bootstrap_data()
    app.run(debug=True, port=5051)
