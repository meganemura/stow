Feature: Keep a generated skill private to one repository

  An agent wrote a skill into a checkout it does not own. The skill belongs
  to the person, not to the repository, so the agent adopts it: stow moves
  it into the person's own skills checkout and links it back where every
  configured host looks for skills, without leaving anything for git to
  commit.

  Scenario: adopting a skill moves it to the overlay and links it for every configured host
    Given a skills checkout and stow configured for Claude Code and Codex
    And a target checkout whose origin is a GitHub repository
    And the agent wrote a skill under the target's shared skill directory
    When the agent adopts the skill
    Then the skill's files live in the overlay for that repository
    And both hosts' discovery paths link to the overlay copy
    And git status in the target shows no new file
    When the agent removes the skill
    Then neither host path links to it any more
