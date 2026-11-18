import os
from email.message import EmailMessage
from PIL import Image, ImageDraw

cwd = 'E:/openclaw/workspace/products/cold-email-arsenal/templates/'

templates_dir = cwd + 'templates/'
# Remove the trailing slash from templates_dir
if templates_dir.endswith('/'): templates_dir = templates_dir[:-1]
generated_templates_dir = cwd + 'generated_templates/'

def generate_template(template_path):
    with open(template_path, 'r') as f:
        template_content = f.read()

    # Parse the email template and extract subject and body
    msg = EmailMessage()
    msg.add_header('Subject', '')
    msg.set_payload(template_content)

    # Create a preview image of the template
    img = Image.new('RGB', (800, 600), color=(73, 109, 137))
    d = ImageDraw.Draw(img)
    d.text((10, 10), subject, fill=(255, 255, 0))
    d.text((10, 30), body, fill=(255, 255, 0))

    # Save the preview image to file
    img.save(cwd + 'preview.png')