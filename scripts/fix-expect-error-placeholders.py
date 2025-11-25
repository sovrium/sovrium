#!/usr/bin/env python3
"""
Replace 'expectError': null placeholders with specific error messages.
Analyzes the test context to determine appropriate error message.
"""

import json
import re
from pathlib import Path

def determine_error_message(spec, file_path):
    """Determine appropriate error message based on spec context"""

    spec_id = spec.get('id', '')
    given = spec.get('given', '').lower()
    when = spec.get('when', '').lower()
    then_text = spec.get('then', '').lower()

    # Check validation block for clues
    validation = spec.get('validation', {})
    field_config = validation.get('setup', {}).get('fieldConfig', {})
    field_type = field_config.get('type', '')
    field_name = field_config.get('name', '')

    # Pattern matching for common error scenarios

    # Invalid enum values
    if 'invalid' in given or 'invalid' in when:
        if 'action' in file_path or 'action' in field_name:
            return "action must be one of: update_field, open_url, trigger_automation"
        if 'format' in file_path or 'format' in field_name:
            return "must match one of the allowed format values"
        if 'style' in file_path or 'style' in field_name:
            return "must be a valid style option"
        if 'aggregation' in file_path:
            return "must be one of: sum, avg, count, min, max, string_agg"
        return "must be one of the allowed values"

    # Validation errors (pattern, format, type)
    if 'validation' in then_text or 'error' in then_text:
        if 'pattern' in then_text or 'format' in then_text:
            if 'url' in file_path:
                return "must be a valid URL format"
            if 'email' in file_path:
                return "must be a valid email format"
            if 'phone' in file_path:
                return "must be a valid phone number format"
            return "must match the required pattern"

        if 'type' in then_text:
            return "must be of the correct type"

        if 'required' in then_text:
            return "is required and cannot be null or empty"

        if 'minimum' in then_text or 'maximum' in then_text:
            return "must be within the allowed range"

        if 'length' in then_text:
            return "must meet length requirements"

    # Schema validation
    if 'schema' in then_text and 'validation' in then_text:
        return "must conform to the defined schema"

    # Default generic message
    return "validation error"

def fix_expect_error_null(file_path):
    """Replace expectError: null with specific error messages"""

    try:
        with open(file_path, 'r') as f:
            data = json.load(f)

        if 'x-specs' not in data:
            return 0

        fixes_count = 0

        for spec in data['x-specs']:
            if 'validation' not in spec:
                continue

            assertions = spec['validation'].get('assertions', [])
            for assertion in assertions:
                if assertion.get('expectError') == None:  # null in JSON
                    error_msg = determine_error_message(spec, str(file_path))
                    assertion['expectError'] = error_msg
                    fixes_count += 1

        if fixes_count > 0:
            with open(file_path, 'w') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
                f.write('\n')

        return fixes_count

    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return 0

def main():
    print("=== FIXING expectError: null PLACEHOLDERS ===\n")

    total_files = 0
    total_fixes = 0

    # Process all schema files
    for schema_file in sorted(Path('specs/app/tables').rglob('*.schema.json')):
        fixes = fix_expect_error_null(schema_file)
        if fixes > 0:
            total_files += 1
            total_fixes += fixes
            print(f"✅ {schema_file} - Fixed {fixes} placeholders")

    print(f"\n{'='*70}")
    print(f"✅ COMPLETE")
    print(f"   Files updated: {total_files}")
    print(f"   Placeholders fixed: {total_fixes}")

if __name__ == '__main__':
    main()
