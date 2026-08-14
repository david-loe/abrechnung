export default {
  auth: {
    ldapauth: {
      url: 'ldaps://ldap:636',
      bindDN: 'cn=admin,dc=planetexpress,dc=com',
      bindCredentials: 'GoodNewsEveryone',
      searchBase: 'ou=people,dc=planetexpress,dc=com',
      searchFilter: '(uid={{username}})',
      tlsOptions: { rejectUnauthorized: false },
      mailAttribute: 'mail',
      uidAttribute: 'uid',
      familyNameAttribute: 'sn',
      givenNameAttribute: 'givenName'
    }
  },
  smtp: {
    host: 'inbucket',
    port: 2500,
    secure: false,
    auth: { authType: 'Login', user: 'username', pass: 'password' },
    senderAddress: 'info@abrechnung.com'
  },
  llm: {
    baseUrl: 'http://ollama:11434/v1',
    model: 'qwen2.5:0.5b-instruct-q4_0',
    apiKey: 'ollama',
    reasoningEffort: 'none',
    maxTokens: null,
    maxPromptOcrCharacters: 12_000,
    timeoutSeconds: 180
  },
  PDFReportsViaEmail: { sendPDFReportsToOrganisationEmail: false, locale: 'de' }
} as const
