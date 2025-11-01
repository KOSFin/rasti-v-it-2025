from django.db import migrations


def ensure_employee_position_schema(apps, schema_editor):
    connection = schema_editor.connection

    with connection.cursor() as cursor:
        # Ensure api_departmentposition table exists
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS api_departmentposition (
                id BIGSERIAL PRIMARY KEY,
                title VARCHAR(200) NOT NULL,
                importance INTEGER NOT NULL DEFAULT 0,
                department_id BIGINT NOT NULL REFERENCES api_department(id) ON DELETE CASCADE
            );
            """
        )

        # Ensure unique constraint on (department_id, title)
        cursor.execute(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'api_departmentposition_department_id_title_key'
                        AND conrelid = 'api_departmentposition'::regclass
                ) THEN
                    ALTER TABLE api_departmentposition
                    ADD CONSTRAINT api_departmentposition_department_id_title_key UNIQUE (department_id, title);
                END IF;
            END $$;
            """
        )

        # Ensure position column rename / addition
        cursor.execute(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'api_employee' AND column_name = 'position_title'
                ) THEN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'api_employee' AND column_name = 'position'
                    ) THEN
                        ALTER TABLE api_employee RENAME COLUMN position TO position_title;
                    ELSE
                        ALTER TABLE api_employee ADD COLUMN position_title VARCHAR(200) DEFAULT '' NOT NULL;
                    END IF;
                END IF;
            END $$;
            """
        )

        # Ensure position_title column type and default are correct
        cursor.execute(
            """
            ALTER TABLE api_employee
            ALTER COLUMN position_title TYPE VARCHAR(200),
            ALTER COLUMN position_title SET DEFAULT '';
            """
        )

        cursor.execute(
            """
            UPDATE api_employee
            SET position_title = ''
            WHERE position_title IS NULL;
            """
        )

        # Ensure foreign key column exists
        cursor.execute(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'api_employee' AND column_name = 'position_id'
                ) THEN
                    ALTER TABLE api_employee ADD COLUMN position_id BIGINT;
                END IF;
            END $$;
            """
        )

        # Ensure foreign key constraint exists
        cursor.execute(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM information_schema.table_constraints
                    WHERE table_name = 'api_employee'
                        AND constraint_name = 'api_employee_position_id_fkey'
                ) THEN
                    ALTER TABLE api_employee
                    ADD CONSTRAINT api_employee_position_id_fkey
                    FOREIGN KEY (position_id)
                    REFERENCES api_departmentposition (id)
                    ON DELETE SET NULL;
                END IF;
            END $$;
            """
        )


def noop(apps, schema_editor):
    """No reverse operation."""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0003_fix_position_title_field'),
    ]

    operations = [
        migrations.RunPython(ensure_employee_position_schema, noop),
    ]
