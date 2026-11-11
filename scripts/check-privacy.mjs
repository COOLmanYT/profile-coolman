import nextEnv from '@next/env'
import { auditPrivacy } from '../lib/privacy-audit.mjs'
import { privacyBuildError } from '../lib/privacy-policy.mjs'

nextEnv.loadEnvConfig(process.cwd())
const findings = await auditPrivacy()
if (findings.length) throw privacyBuildError(findings)
console.log('Privacy check passed')
