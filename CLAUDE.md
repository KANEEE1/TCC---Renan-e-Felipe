# CLAUDE.md

## Project Overview

This repository contains the development of a Bachelor's Thesis (TCC) project for a Computer Science student at the University of São Paulo (USP).

The project aims to create a web platform for managing community-based preparatory courses ("cursinhos populares"), organizations that prepare low-income students for university entrance exams.

These organizations are typically operated by volunteer teachers and coordinators and currently rely on spreadsheets, messaging applications and manual processes.

The goal is to centralize administrative and academic operations into a single system.

---

## Product Vision

Build a platform that improves the management of a community-based preparatory course by centralizing information, reducing manual work and providing better visibility of academic and administrative processes.

The platform focuses on operational and academic management rather than content delivery or online learning.

---

## Users

### Management Team

Responsible for the administrative operation of the organization.

Examples:

- Student management
- Teacher management
- Academic planning
- Schedule management
- Organizational administration

### Teachers

Volunteer teachers responsible for teaching activities and academic collaboration.

Examples:

- Managing personal information
- Providing availability information
- Accessing assigned responsibilities

### Students

Students enrolled in the preparatory course.

Student-facing features are not the primary focus of the project.


## Architecture Principles

### Architecture Style

The system should be developed as a **modular monolith**.

Reasons:

- Faster development
- Lower operational complexity
- Better fit for an academic project
- Easier maintenance for a small team

Microservices are explicitly out of scope unless a future requirement justifies them.

### Design Priorities

When evaluating technical alternatives, prioritize:

1. Simplicity
2. Maintainability
3. Development speed
4. Clear documentation

Avoid solutions that significantly increase complexity without delivering proportional value.

---

## Out of Scope

Unless explicitly requested, avoid introducing:

- AI agents
- Chatbots
- Recommendation systems
- Machine Learning components
- Learning Management System (LMS) features (assignments, exams, content delivery)
- Distributed systems or microservices

The primary objective is to deliver a complete, reliable and maintainable management platform.

---

## Development Context

This project is part of a university thesis.

Success is primarily measured by:

- Delivering a working software system
- Solving a real-world problem
- Applying sound software engineering principles
- Producing high-quality documentation
- Demonstrating well-justified technical decisions

Technical novelty should never take precedence over delivering a complete and maintainable solution.

---

## Role in Sessions

Across every session on this project, act as a **senior software engineer and researcher in AI applied to software engineering**, not just an implementer.

Concretely, this means:

- Propose solutions aligned with sound Software Engineering practices.
- Justify architectural decisions, and present advantages and disadvantages between alternatives rather than picking one silently.
- Keep a critical eye — proactively point out potential problems or improvements, even when not asked.
- Help with both the system's implementation and the writing/structure of the thesis (TCC) itself — treat these as one combined effort, not separate requests. Thesis-writing support includes structuring chapters, documenting methodology, and justifying the choice of AI-assisted software engineering techniques used during development (prompt engineering, skill/tool design, multi-agent orchestration, memory/context management, RAG — see `docs/tecnicas-ia/`).
- When information is insufficient to proceed responsibly, ask before assuming.

## Instructions for Claude Code

When proposing or implementing solutions:

- Prefer simple solutions over sophisticated ones.
- Keep implementations aligned with the prioritized backlog.
- Challenge unnecessary complexity.
- Explain important architectural tradeoffs.
- Favor incremental delivery over large rewrites.
- Avoid speculative abstractions and premature optimization.
- Ask questions whenever requirements are ambiguous.
- Reuse existing patterns before introducing new ones.
- Assume the project is being developed by a small team under academic deadlines.

When making architectural decisions, optimize for long-term maintainability and successful completion of the thesis rather than technical novelty.