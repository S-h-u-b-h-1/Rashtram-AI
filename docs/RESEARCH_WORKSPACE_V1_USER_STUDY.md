# Rashtram AI — Research Workspace V1 User Study Plan

Status: planned follow-up validation for the technically released V1  
Owner: Product / Research  
Sample: 5–8 representative participants  
Duration: 30–40 minutes per participant

## Purpose

Evaluate whether the simplified Research Workspace is understandable without a product walkthrough. This study measures navigation comprehension, source-scope comprehension, citation discovery and resumption—not legal-answer accuracy or a 5–10 second usability target.

## Participants

Recruit 5–8 people who regularly read, compare or act on policy and regulatory material. Aim for coverage across:

- policy or research student
- CA / compliance professional
- lawyer or legal researcher
- public-policy researcher
- business / MSME user

Record role, frequency of document research and familiarity with AI research tools. Do not collect unnecessary personal, client or confidential document data.

## Moderation protocol

1. Obtain consent to observe the session and record screen/audio if the participant agrees.
2. Give only this framing: “Please use Rashtram AI to complete these tasks. Think aloud when convenient; I may ask what you expected to happen.”
3. Do not explain New Research, Library, My Research, Sources, Chat or Studio before the tasks.
4. Use a dedicated test account and disposable documents. Never ask participants to upload confidential material.
5. Do not rescue a task immediately. Note the first wrong turn, hesitation and recovery. Provide a neutral stop prompt only after two minutes or when the participant asks for help.
6. End with a short debrief about labels, confidence, trust and what they expected to find.

## Task script

Use the same task wording for every participant, in this order:

1. **Find an Act.** “Find the Digital Personal Data Protection Act and open it.”
2. **Ask a cited question.** “Ask a question that should be answered from this Act, then show me how you would verify the answer.”
3. **Upload a PDF.** “Add this provided disposable PDF as a source, ask one source-specific question and find the supporting passage.”
4. **Compare two documents.** “Compare the two provided documents and identify one meaningful difference.”
5. **Return to previous research.** “Leave this area, then return to the research you were just doing.”

If a task is blocked by an environment outage, mark it as an environment failure rather than coaching the participant or treating it as a product result.

## Measures to capture

For each task record:

- first click and first visible action
- task completion: complete, partial or blocked
- time to first useful result (from task start to first answer, source or comparison output the participant accepts as useful)
- wrong turns, backtracks and navigation loops
- hesitation moments and participant language explaining labels
- whether the participant understands New Research versus Library
- whether the participant understands Sources versus Chat versus Studio
- whether citations are noticed without prompting and whether the participant can open provenance
- whether the participant knows how to resume saved work
- moderator intervention, if any, with the exact wording used

Capture screen video only with consent. The observation sheet should use participant IDs (P01–P08), not names. Save notes and recordings in the approved restricted research location.

## Debrief questions

Ask after all tasks:

1. What did you think New Research was for? What did you think Library was for?
2. Where would you go to continue something you started yesterday?
3. What did Sources, Chat and Studio mean to you?
4. How did you decide whether an answer was trustworthy?
5. What, if anything, felt unnecessary or confusing?
6. What would you change before using this for real work?

## Analysis

Create a task-by-participant matrix with completion, time, first click, wrong turns and interventions. Cluster qualitative notes into navigation, source scope, citation/provenance, resumption, mobile/layout and language themes. Report medians and ranges for time measures; do not infer statistical significance from 5–8 participants. Separate environment failures from usability failures.

## Decision rules

This is diagnostic product validation, not a launch gate. Recommend a narrowly scoped follow-up only when at least two participants show the same comprehension failure or navigation trap. Preserve the V1 information architecture unless observed evidence identifies a concrete blocker. Do not claim that a 5–10 second target passed unless it is directly observed and recorded for the relevant task.

## Deliverables

- anonymized observation sheets for P01–P08
- task completion and timing matrix
- top five recurring usability findings with supporting examples
- prioritized fixes mapped to existing V1 surfaces
- a short decision memo stating whether V1 labels and source-scope handoff are understandable

No corpus ingestion, ranking, connector, retrieval or new visible-feature work is part of this study.
