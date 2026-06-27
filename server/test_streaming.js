const http = require('http');

const testStreaming = (path, body) => {
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  };

  console.log(`Testing ${path}...`);

  const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);

    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      console.log(`BODY: ${chunk}`);
    });

    res.on('end', () => {
      console.log('No more data in response.');
    });
  });

  req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
  });


  req.write(JSON.stringify(body));
  req.end();
};


testStreaming('/api/bill/chat', {
  message: 'What is the purpose of this bill?',
  billId: 'test-bill-id'
});
