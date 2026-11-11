import { resolve } from 'node:path'
import { privacyBuildError } from '../lib/privacy-policy.mjs'
import { auditPrivacyOutput } from '../lib/privacy-output.mjs'

const findings = await auditPrivacyOutput(resolve(process.argv[2] ?? '.next')).catch(() => ['could not inspect the production build output'])
if (findings.length) throw privacyBuildError(findings)
console.log('Production output privacy check passed')
