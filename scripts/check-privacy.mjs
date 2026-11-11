import nextEnv from '@next/env'
import { auditPrivacy, privacyBuildError } from '../lib/privacy-audit.mjs'

nextEnv.loadEnvConfig(process.cwd())
const findings = await auditPrivacy()
if (findings.length) throw privacyBuildError(findings)
console.log('Privacy check passed')
