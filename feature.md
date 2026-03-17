# 📦 Capsule App – Feature Specification

## 🧭 Overview

A web-based application that allows users to create, organize, and share markdown (MD) capsules. Users can keep content private, share with specific users, or publish publicly.

---

# 🎯 Core Concept

* Each user owns their own data (folders & capsules)
* Capsules can be:

  * Private (default)
  * Shared (specific users)
  * Public (accessible without authentication)

---

# 👤 Authentication & Identity

* Authentication handled via Clerk
* No local user authentication system required
* No local `User` table required for ownership scoping
* `clerkUserId` is the ownership key stored directly on domain records (Folder, Capsule)

---

# 📁 Feature: Folder Management

## Description

Users can organize capsules into folders.

## Capabilities

* Create folder
* Rename folder
* Delete folder
* List all folders (scoped to user)

## Rules

* Folder belongs to a single user
* Deleting a folder does NOT delete capsules (optional behavior: set folderId to null)

---

# 📝 Feature: Capsule Management

## Description

Core feature allowing users to create markdown-based content.

## Capabilities

* Create capsule
* Edit capsule
* Delete capsule
* Move capsule between folders
* Auto-save content

## Fields

* title
* content (markdown)
* folderId (optional)
* clerkUserId (owner)
* isPublic (boolean)

---

# 🔐 Feature: Access Control

## Access Types

1. Owner Access
2. Shared Access
3. Public Access

## Rules

* Owner always has full control
* Shared users have limited permissions (read/edit)
* Public capsules are read-only

---

# 🤝 Feature: Capsule Sharing

## Description

Allow users to share capsules with other registered users.

## Capabilities

* Share capsule via email or user lookup
* Assign permission:

  * read
  * edit
* Revoke access

## Data Model

CapsuleShare:

* capsuleId
* sharedWithId (clerkUserId)
* permission

## Rules

* No duplicate shares per user
* Owner cannot be removed

---

# 🌍 Feature: Public Sharing

## Description

Allow capsules to be publicly accessible via link.

## Capabilities

* Toggle public/private
* Generate public URL (slug optional)

## Rules

* Public capsules are read-only
* No authentication required

---

# 🔎 Feature: Capsule Access Logic

## Access Conditions

A user can access a capsule if:

* They are the owner
* The capsule is shared with them
* The capsule is public

---

# 🧠 Feature: Search & Filtering (Optional)

## Capabilities

* Search capsules by title/content
* Filter by folder
* Filter by ownership/shared

---

# 🧾 Feature: Activity Tracking (Optional)

## Capabilities

* Track edits
* Track sharing actions
* Show last updated timestamps

---

# 🧱 Data Model Summary

## Folder

* id
* name
* clerkUserId
* createdAt
* updatedAt

## Capsule

* id
* title
* content
* clerkUserId
* folderId
* isPublic
* createdAt
* updatedAt

## CapsuleShare

* id
* capsuleId
* sharedWithId (clerkUserId)
* permission

---

# 🔐 Security Considerations

* Always filter queries by `clerkUserId` OR access rules
* Never trust client-side filtering
* Validate ownership before mutation
* Resolve `userId` from Clerk `auth()` on every request
* Do not rely on webhook-delivered identity state for authorization

---

# ⚡ Performance Considerations

* Index `clerkUserId`
* Index `folderId`
* Index `capsuleId` in sharing table

---

# 🚀 Future Enhancements

* Rich markdown editor
* Version history
* Comments on capsules
* Real-time collaboration
* Export (PDF/Markdown)

---

# 🧩 Summary

This system follows a **user-owned resource model with sharing capabilities**:

* Simple architecture
* Direct ownership scoping via `clerkUserId`
* No webhook dependency for user provisioning
* Scales into collaborative features

---

# ✅ Status

Ready for implementation and iteration.
