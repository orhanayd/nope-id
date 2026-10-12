# Security Policy

## Supported versions

Security fixes are released for the latest release line only.

| Version | Supported |
| ------- | --------- |
| 1.4.x   | Yes       |
| < 1.4   | No        |

## Reporting a vulnerability

Please report suspected vulnerabilities privately through GitHub's private
vulnerability reporting:

https://github.com/orhanayd/nope-id/security/advisories/new

Do not open a public issue for a suspected vulnerability. A useful report includes:

- the affected nope-id version and entry point (`nope-id` or `nope-id/non-secure`)
- the runtime (Node.js version, browser, React Native) and module format (ESM or CommonJS)
- a minimal reproduction and the impact you observed

Confirmed issues are fixed in a patch release and published as a GitHub security
advisory with an exact affected-version range, so that scanners report only the
versions that are actually vulnerable.

## Scope

- The secure entry (`nope-id`) always draws from the platform CSPRNG (`node:crypto`
  or Web Crypto). Predictable or biased output, collisions beyond the documented
  probability, and exposure of `secureToken()`, `apiKey()` or `defineToken()` secrets
  are in scope.
- Inputs that make a function hang, crash the process or exhaust memory (for example
  oversized sizes or malformed alphabets) are in scope as denial-of-service bugs.
- `nope-id/non-secure` uses `Math.random()` by design and must not be used for
  secrets; predictable output from that entry is expected behavior, not a vulnerability.
