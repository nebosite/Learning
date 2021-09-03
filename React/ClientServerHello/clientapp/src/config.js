const oktaAuthConfig = {
    // Note: If your app is configured to use the Implicit Flow
    // instead of the Authorization Code with Proof of Code Key Exchange (PKCE)
    // you will need to add `pkce: false`
    issuer: 'https://dev-35941454.okta.com/oauth2/default',
    clientId: '0oabim81sskJtegzK5d6',
    redirectUri: 'http://localhost:4644/api/authorize',
  };
  
  const oktaSignInConfig = {
    baseUrl: 'https://dev-35941454.okta.com',
    clientId: '0oabim81sskJtegzK5d6',
    redirectUri: 'http://localhost:4644/api/login',
    authParams: {
      // If your app is configured to use the Implicit Flow
      // instead of the Authorization Code with Proof of Code Key Exchange (PKCE)
      // you will need to uncomment the below line
      // pkce: false
    }
  };
  
  export { oktaAuthConfig, oktaSignInConfig };