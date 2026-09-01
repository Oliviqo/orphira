# Orphira — Third-Party Services

Last updated: 2026

Copyright (c) 2026 Olivia Løvgreen

Contact: orphiraplayer@gmail.com


## 1. Purpose

Orphira is primarily a local music player.

Some optional features of Orphira may communicate with third-party
services in order to provide additional functionality such as metadata
lookup, acoustic identification, lyrics lookup, artwork retrieval, or
other optional online features.

Third-party services are independent from Orphira and are operated by
their respective owners.

This document describes the general relationship between Orphira,
third-party services, plugins, and users.


## 2. Local-First Operation

The core functionality of Orphira is designed around music files stored
locally on the user's device.

Depending on the installed version and enabled features, local
functionality may include:

- playback of local audio files;
- reading metadata embedded in audio files;
- reading embedded artwork;
- reading embedded lyrics;
- reading compatible external lyrics files;
- organizing a local music library;
- playlists and playback queues;
- audio processing and playback controls;
- local search;
- other functionality that does not require a third-party online
  service.

Online functionality is supplemental and is not guaranteed to be
available.


## 3. Third-Party Services

Orphira may optionally communicate with third-party services.

Each third-party service is governed by its own terms, policies,
licenses, technical restrictions, and availability conditions.

Orphira does not own or control third-party services.

The inclusion of compatibility or integration with a third-party
service does not imply sponsorship, endorsement, partnership,
affiliation, or approval by the operator of that service unless
explicitly stated otherwise.


## 4. Service-Specific Terms

Use of a third-party service through Orphira may be subject to separate
terms established by the operator of that service.

Users remain responsible for complying with terms that independently
apply to their use of a third-party service.

Where a service requires credentials, API keys, accounts, authorization,
or other access requirements, users and plugin developers must comply
with the requirements established by the applicable service provider.

Orphira does not grant any rights to a third-party service or its
content beyond rights that the respective service operator or applicable
law independently grants to the user.


## 5. Information Sent to Third-Party Services

When an online feature is used, Orphira or an installed plugin may need
to send information required to perform the requested operation.

Depending on the feature and provider, this information may include:

- track title;
- artist name;
- album name;
- track duration;
- release identifiers;
- metadata search queries;
- an acoustic fingerprint calculated from a local audio file;
- other information necessary for the explicitly requested online
  operation.

Where acoustic fingerprinting is used, an implementation may calculate
the fingerprint locally and send the resulting fingerprint and related
technical information to an identification service.

Unless explicitly stated by a particular feature or plugin, Orphira
does not intentionally upload the user's complete local audio file to a
third-party metadata, lyrics, or acoustic-identification service.

The exact behavior of independently installed third-party plugins may
differ and should be reviewed before installation.


## 6. Online Content

Third-party services may return information or content including:

- metadata;
- identifiers;
- lyrics;
- artwork;
- search results;
- recognition results;
- links;
- other provider-specific data.

Ownership of such information or content is not transferred to Orphira
merely because Orphira can request, display, process, or cache it.

Copyright, database rights, trademarks, contractual restrictions, and
other rights in third-party content remain with their respective
owners where applicable.

Availability through an API or website does not by itself mean that
content is free of copyright or other restrictions.


## 7. Local Caching

Some online features may temporarily or persistently cache data on the
user's device in order to improve performance, reduce repeated network
requests, provide offline functionality, or avoid unnecessary load on a
third-party service.

Caching behavior may depend on:

- the applicable service;
- the installed provider or plugin;
- provider requirements;
- application configuration;
- the type of data involved.

Orphira should not intentionally cache third-party content where the
applicable provider explicitly prohibits such caching.

Cached data may be removable through Orphira's data-management
functionality when supported.

Removing Orphira's cache does not necessarily remove data independently
stored by third-party plugins or external applications.


## 8. Availability and Changes

Third-party services may:

- become temporarily unavailable;
- permanently discontinue service;
- change their APIs;
- change authentication requirements;
- modify rate limits;
- modify their terms or policies;
- remove or modify content;
- restrict access;
- block applications or users;
- return incomplete or inaccurate information.

Orphira does not guarantee the continued availability, compatibility,
accuracy, completeness, or reliability of any third-party service.

A failure of an online provider should not be interpreted as a failure
of ownership or availability of the user's local music files.


## 9. Rate Limits and Responsible Access

Orphira and official integrations should make reasonable efforts to
respect documented rate limits and technical requirements of
third-party services.

Third-party plugins are expected to do the same.

Service operators may impose additional restrictions at any time.

Users should not intentionally use Orphira or its plugin system to
circumvent access controls, rate limits, authentication requirements,
digital rights management, or other technical restrictions imposed by
a third-party service.


## 10. Plugins

Orphira may support optional plugins or extensions.

Third-party plugins are separate software components and may be
developed, maintained, distributed, and licensed by independent
developers.

Installing a plugin may enable additional network connections or access
to additional third-party services.

A plugin may be subject to:

- its own license;
- its own privacy policy;
- third-party service terms;
- additional permissions;
- independent security risks.

Compatibility with Orphira does not automatically mean that a plugin
has been reviewed, approved, endorsed, or audited by Orphira or its
maintainer.

Users should install plugins only from sources they trust and should
review the permissions and documentation presented for a plugin.

Where Orphira provides technical permission controls or sandboxing,
those controls are intended to reduce risk but are not a guarantee that
third-party software is free from defects or malicious behavior.


## 11. User-Provided Plugins and Providers

Orphira may allow users to install plugins or providers from files,
repositories, URLs, or other external sources.

The existence of a general-purpose plugin installation mechanism does
not make every third-party plugin part of Orphira.

Independent plugin authors are responsible for ensuring that their
plugins comply with applicable laws, licenses, service terms, and other
requirements relevant to their implementations.

Orphira may remove references to a plugin from an official listing if
the plugin is believed to be unsafe, incompatible, abandoned, or
inconsistent with applicable requirements.


## 12. Credentials and API Keys

Some third-party services may require an API key, account, access token,
or other credential.

Credentials should only be used in accordance with the rules of the
service that issued them.

Users and plugin developers should not use application credentials
belonging to unrelated third-party applications unless the applicable
service explicitly permits such use.

Orphira does not guarantee that credentials embedded in or supplied to
a plugin are stored or handled securely unless the relevant Orphira
feature explicitly provides such a guarantee.


## 13. Privacy

Network requests necessarily disclose certain technical information to
the destination service, which may include the user's IP address and
other information normally associated with an Internet connection.

Third-party services may independently collect or process information
according to their own privacy policies.

Orphira does not control the privacy practices of independent
third-party service operators.

Additional information about Orphira's own handling of user data should
be provided in the project's PRIVACY.md document.


## 14. Security

Communication with third-party services and installation of third-party
plugins may introduce risks that do not exist during purely local
operation.

These risks may include:

- service compromise;
- malicious responses;
- compromised plugins;
- unauthorized plugin modifications;
- dependency vulnerabilities;
- privacy risks;
- unexpected network behavior.

Users should keep Orphira and installed plugins reasonably up to date
and should avoid installing software from untrusted sources.


## 15. No Warranty for Third-Party Services

TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THIRD-PARTY
INTEGRATIONS, SERVICES, PLUGINS, DATA, AND CONTENT ARE MADE AVAILABLE
THROUGH ORPHIRA ON AN "AS IS" AND "AS AVAILABLE" BASIS.

ORPHIRA AND ITS MAINTAINER DO NOT GUARANTEE THE AVAILABILITY, ACCURACY,
LEGAL STATUS, SECURITY, QUALITY, FITNESS, OR RELIABILITY OF INDEPENDENT
THIRD-PARTY SERVICES, PLUGINS, OR CONTENT.


## 16. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE ORPHIRA
MAINTAINER AND CONTRIBUTORS WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL,
SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR OTHER DAMAGES ARISING FROM OR
RELATED TO THE USE, FAILURE, UNAVAILABILITY, OR BEHAVIOR OF AN
INDEPENDENT THIRD-PARTY SERVICE OR PLUGIN.

NOTHING IN THIS DOCUMENT EXCLUDES OR LIMITS LIABILITY THAT CANNOT
LAWFULLY BE EXCLUDED OR LIMITED.

## 17. Contact

Questions regarding Orphira's official third-party service integrations
may be sent to:

orphiraplayer@gmail.com