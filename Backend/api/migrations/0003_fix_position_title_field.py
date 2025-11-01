# Generated to fix the position_title field in Employee model to ensure it exists in database
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0002_auto_add_roles_and_goal_participants'),
    ]

    operations = [
        # Додаємо поле position_title, якщо воно ще не існує (можливо, попередня міграція не виконалася)
        migrations.RunSQL(
            # SQL для перевірки наявності стовпця і додавання, якщо він не існує
            "DO $$ "
            "BEGIN "
            "IF NOT EXISTS (SELECT 1 FROM information_schema.columns "
            "WHERE table_name = 'api_employee' AND column_name = 'position_title') THEN "
            "ALTER TABLE api_employee ADD COLUMN position_title VARCHAR(200) DEFAULT ''; "
            "END IF; "
            "END $$;",
            reverse_sql="ALTER TABLE api_employee DROP COLUMN IF EXISTS position_title;"
        ),
    ]