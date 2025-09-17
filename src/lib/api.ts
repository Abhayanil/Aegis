// Minimal frontend API helpers to talk to the backend

export async function uploadMaterials(formData: FormData) {
  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
}

export async function generateDealMemo(payload: {
  parsedText: string;
  analystFocus: string;
  publicData: any;
  provider?: 'openai' | 'gemini';
}) {
  const res = await fetch('/api/deal-memo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('AI generation failed');
  return res.json();
}

export async function exportMemoJSON(data: any) {
  const res = await fetch('/api/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  return blob;
}