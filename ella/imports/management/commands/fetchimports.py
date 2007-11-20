from django.core.management.base import NoArgsCommand
from optparse import make_option
import sys

class Command(NoArgsCommand):
    help = 'Fetch all registered imports'
    def handle(self, *test_labels, **options):
        from ella.imports.models import fetch_all
        errors = fetch_all()
        if errors:
            sys.exit(errors)