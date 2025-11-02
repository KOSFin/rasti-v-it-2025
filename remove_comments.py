import os
import re
import sys

def remove_py_comments(content):
    lines = content.split('\n')
    result = []
    in_docstring = False
    docstring_char = None
    
    for line in lines:
        stripped = line.strip()
        
        if not in_docstring:
            if stripped.startswith('"""') or stripped.startswith("'''"):
                docstring_char = stripped[:3]
                if stripped.count(docstring_char) >= 2:
                    continue
                else:
                    in_docstring = True
                    continue
            elif stripped.startswith('#'):
                continue
            elif '#' in line and not ('"' in line or "'" in line):
                code_part = line.split('#')[0].rstrip()
                if code_part:
                    result.append(code_part)
            else:
                result.append(line)
        else:
            if docstring_char in line:
                in_docstring = False
                docstring_char = None
    
    return '\n'.join(result)

def remove_js_comments(content):
    content = re.sub(r'//.*?$', '', content, flags=re.MULTILINE)
    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
    
    lines = content.split('\n')
    result = []
    for line in lines:
        if line.strip():
            result.append(line)
        elif result and result[-1].strip():
            result.append(line)
    
    return '\n'.join(result)

def process_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        if filepath.endswith('.py'):
            new_content = remove_py_comments(content)
        elif filepath.endswith(('.js', '.jsx')):
            new_content = remove_js_comments(content)
        else:
            return
        
        if new_content != content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Processed: {filepath}")
    except Exception as e:
        print(f"Error processing {filepath}: {e}")

def main():
    backend_dir = os.path.join(os.path.dirname(__file__), 'Backend')
    frontend_dir = os.path.join(os.path.dirname(__file__), 'Frontend')
    
    for root, dirs, files in os.walk(backend_dir):
        for file in files:
            if file.endswith('.py') and 'migrations' not in root:
                filepath = os.path.join(root, file)
                process_file(filepath)
    
    for root, dirs, files in os.walk(frontend_dir):
        if 'node_modules' in root:
            continue
        for file in files:
            if file.endswith(('.js', '.jsx')):
                filepath = os.path.join(root, file)
                process_file(filepath)

if __name__ == '__main__':
    main()
