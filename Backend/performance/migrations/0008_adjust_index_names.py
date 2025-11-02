from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("performance", "0007_seed_default_skills_and_periods"),
    ]

    # No-op migration: index names already aligned by 0002 rename ops
    operations = []
