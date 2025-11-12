import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.users import AppUser
from app.core.security import get_password_hash

def create_admin():
    db = SessionLocal()
    try:
        # Delete existing admin if any
        db.query(AppUser).filter(AppUser.username == 'admin').delete()
        
        # Use a shorter password to avoid bcrypt limits
        password = "Solo1551"  # Shorter password
        
        # Create new admin with proper password hash
        admin_user = AppUser(
            username="OSSAD",
            full_name="System Administrator",
            role="admin", 
            is_active=True,
            hashed_password=get_password_hash(password)
        )
        
        db.add(admin_user)
        db.commit()
        
        print("✅ Admin user created successfully!")

        
        # Verify the password works
        from app.core.security import verify_password
        is_valid = verify_password(password, admin_user.hashed_password)
        print(f"Password verification: {is_valid}")
        
    except Exception as e:
        print(f"❌ Error creating admin: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_admin()