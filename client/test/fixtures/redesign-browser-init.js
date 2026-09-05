// Isolated visual-test browser only. This token is accepted only by the local fixture.
if (location.origin === 'http://localhost:5050') sessionStorage.setItem('auth-token', 'local-visual-fixture');
