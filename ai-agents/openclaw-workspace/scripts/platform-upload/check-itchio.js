import https from 'https';
https.get('https://itch.io/login', {headers:{'User-Agent':'Mozilla/5.0'}}, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const inputs = Array.from(d.matchAll(/input[^>]+name="([^"]+)"/g)).map(m => m[1]);
    console.log('Form inputs:', inputs);
    // also check for username field
    if (d.includes('username')) console.log('Has username field');
    if (d.includes('email')) console.log('Has email field');
  });
});
