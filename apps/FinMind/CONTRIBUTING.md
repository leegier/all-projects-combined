# Contributing to FinMind

Thanks for contributing. This project follows a strict review model to protect production quality.

## Contribution Model
- All contributors must fork this repository first.
- Create feature branches in your fork.
- Open Pull Requests from your fork branch into `rohitdash08/FinMind:main`.
- Direct pushes to `main` are not allowed.
- No PR is merged without repository owner approval.

## Standard Flow
1. Fork the repo.
2. Clone your fork.
3. Create a branch from `main`:
   - `git checkout -b feat/<short-name>`
4. Make changes with tests.
5. Run checks locally:
   - Frontend: `cd app && npm run lint && npm test -- --runInBand`
   - Backend (Docker): `cd .. && ./scripts/test-backend.ps1`
6. Push branch to your fork.
7. Open PR to `main` and complete template/checklist.

## Pull Request Requirements
- Keep PRs focused and reasonably small.
- Include tests for behavior changes.
- Update docs when behavior/deployment/process changes.
- Ensure CI is green.
- Wait for owner review and approval before merge.

## Branch Protection Rules (Owner Setup)
Configure these in GitHub for branch `main`:
- Require a pull request before merging.
- Require approvals: at least `1`.
- Require review from Code Owners.
- Dismiss stale approvals on new commits.
- Require status checks to pass before merging.
- Restrict who can push to matching branches (owner only).
- Include administrators.

