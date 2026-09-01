# Orphira — Third-Party Software Notices

Last updated: August 31, 2026

Orphira includes and depends on third-party software.

This document identifies significant third-party software components used directly by Orphira and provides references to their respective projects and licensing information.

Third-party components remain the property of their respective authors and copyright holders.

Unless explicitly stated otherwise, inclusion of a third-party component does not imply that its authors, maintainers, or affiliated organizations sponsor, endorse, or are affiliated with Orphira.

The license applicable to Orphira's own source code does not replace, modify, or supersede licenses applicable to third-party components.

## 1. Electron

Project:  
Electron

Purpose in Orphira:  
Desktop application runtime.

Project website:  
[https://www.electronjs.org/](https://www.electronjs.org/)

Source code:  
[https://github.com/electron/electron](https://github.com/electron/electron)

License information:  
[https://github.com/electron/electron/blob/main/LICENSE](https://github.com/electron/electron/blob/main/LICENSE)

Orphira currently declares Electron as a development dependency.

Electron itself incorporates additional third-party software. Applicable notices distributed with the Electron runtime remain applicable to those components.

## 2. electron-log

Project:  
electron-log

Purpose in Orphira:  
Application logging.

Source code:  
[https://github.com/megahertz/electron-log](https://github.com/megahertz/electron-log)

Package:  
[https://www.npmjs.com/package/electron-log](https://www.npmjs.com/package/electron-log)

License information:  
[https://github.com/megahertz/electron-log/blob/master/LICENSE](https://github.com/megahertz/electron-log/blob/master/LICENSE)

Orphira currently declares electron-log as a runtime dependency.

## 3. music-metadata

Project:  
music-metadata

Purpose in Orphira:  
Reading metadata, technical audio information, embedded artwork, and supported embedded lyrics from local audio files.

Source code:  
[https://github.com/Borewit/music-metadata](https://github.com/Borewit/music-metadata)

Package:  
[https://www.npmjs.com/package/music-metadata](https://www.npmjs.com/package/music-metadata)

License information:  
[https://github.com/Borewit/music-metadata/blob/master/LICENSE.txt](https://github.com/Borewit/music-metadata/blob/master/LICENSE.txt)

Orphira currently declares music-metadata as a runtime dependency.

## 4. chokidar

Project:  
chokidar

Purpose in Orphira:  
Monitoring connected music directories for file additions, removals, and changes.

Source code:  
[https://github.com/paulmillr/chokidar](https://github.com/paulmillr/chokidar)

Package:  
[https://www.npmjs.com/package/chokidar](https://www.npmjs.com/package/chokidar)

License information:  
[https://github.com/paulmillr/chokidar/blob/main/LICENSE](https://github.com/paulmillr/chokidar/blob/main/LICENSE)

Orphira currently declares chokidar as a runtime dependency.

## 5. Chromaprint / fpcalc

Project:  
Chromaprint

Component used by Orphira:  
fpcalc command-line executable.

Purpose in Orphira:  
Local computation of acoustic fingerprints used by the optional AcoustID identification pipeline.

Project website:  
[https://acoustid.org/chromaprint](https://acoustid.org/chromaprint)

Source project:  
[https://github.com/acoustid/chromaprint](https://github.com/acoustid/chromaprint)

Orphira invokes fpcalc as a separate command-line process.

The user's audio file is processed locally by fpcalc. Orphira may subsequently transmit the resulting acoustic fingerprint and track duration to AcoustID for identification. The audio file itself is not transmitted to AcoustID by this process.

IMPORTANT DISTRIBUTION NOTICE:

The exact license obligations applicable to a distributed fpcalc binary depend on the particular binary and build that is included with Orphira.

Before publicly distributing Orphira with fpcalc, the distributor must identify and retain the provenance of the exact fpcalc build being shipped and comply with all license obligations applicable to that build.

Where the distributed build is governed by the GNU General Public License or another license requiring provision of corresponding source code, license notices, or additional materials, those requirements must be satisfied independently of the license chosen for Orphira's own source code.

The distributed package should therefore include, as applicable:

- the license text required for the exact fpcalc build;
    
- applicable copyright and attribution notices;
    
- information identifying the version and source of the distributed build;
    
- corresponding source code, or a legally sufficient method of obtaining it, where required by the applicable license;
    
- build scripts or other materials where required by the applicable license.
    

The presence of this notice alone does not satisfy source-code or other distribution obligations that may apply to the specific fpcalc binary.

## 6. Transitive Dependencies

The software listed above is not necessarily an exhaustive list of every third-party package contained in a packaged Orphira distribution.

Electron and npm packages may themselves depend on additional third-party components.

The definitive dependency set for a particular source revision is represented by the project's package manifest and lockfile, including:

- package.json
    
- package-lock.json
    

A packaged Electron runtime may additionally contain third-party software and notices originating from Electron, Chromium, Node.js, FFmpeg, and their respective dependency trees.

Applicable licenses and notices supplied with those components remain in effect.

## 7. Web Fonts

Orphira may request font resources from Google Fonts when a supported web font is selected or loaded by the application interface.

Google Fonts:  
[https://fonts.google.com/](https://fonts.google.com/)

Google Fonts FAQ and licensing information:  
[https://developers.google.com/fonts/faq](https://developers.google.com/fonts/faq)

Individual font families may be provided under their own open-source font licenses.

The fonts referenced by Orphira's interface include or may include:

- Outfit;
    
- Plus Jakarta Sans;
    
- Inter;
    
- Roboto;
    
- Space Grotesk;
    
- Sora;
    
- Urbanist;
    
- Poppins;
    
- Montserrat;
    
- Manrope;
    
- Lexend;
    
- Syne.
    

The applicable license for an individual font is determined by that font's authors and distribution terms.

## 8. Third-Party Online Services

Third-party network services are intentionally documented separately from bundled software dependencies.

For information about MusicBrainz, AcoustID, Cover Art Archive, LRCLIB, the data sent to those services, and the storage behavior of Orphira, see:

THIRD_PARTY_SERVICES.md

## 9. No Transfer of Third-Party Rights

Nothing in the Orphira license grants rights in third-party software, trademarks, artwork, lyrics, metadata, or other third-party material beyond rights provided by their respective licenses, terms, or applicable law.

Third-party names and trademarks are the property of their respective owners.

## 10. Source and License Verification

When preparing an official Orphira release, the distributor should verify the actual versions included in that release rather than relying exclusively on this document.

In particular, release preparation should verify:

1. package.json and package-lock.json;
    
2. the Electron version included in the packaged application;
    
3. the provenance and version of fpcalc;
    
4. applicable third-party license files;
    
5. any newly added runtime dependencies;
    
6. whether any dependency license changed since the previous release.
    

This document should be updated when significant third-party components are added, removed, or replaced.

## 11. Contact

Questions concerning Orphira's own distribution, third-party notices, or a possible licensing issue may be reported through the official Orphira project contact channel.

Official project information and contact details should be provided by the Orphira distributor in the repository and release documentation.