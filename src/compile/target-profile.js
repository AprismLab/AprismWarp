'use strict';

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover


/**
 * The list of Aprism target profiles AprismWarp has verified end-to-end.
 * Each profile records the (Minecraft, Aprism) version pair the
 * generator and runtime loaders have been tested against. The list is
 * deliberately small: adding a profile requires fresh Aprism contract
 * verification and a new round of integration tests.
 *
 * Each entry also carries the SemVer range that the embedded
 * {@code aprism-api.jar} actually satisfies. The range is included so
 * the validator can surface actionable diagnostics when a project
 * targets an Aprism version that the local build does not provide.
 *
 * @type {ReadonlyArray<{minecraft: string, aprism: string, aprismRange: string}>}
 */
const VERIFIED_PROFILES = Object.freeze([
    Object.freeze({minecraft: '26.2', aprism: 'v26.8-Alpha.7', aprismRange: '>=26.8.0 <26.9.0'})
]);

const SEMVER_RELEASE = /^v?(\d+)\.(\d+)(?:-Alpha\.(\d+)|\.(\d+))(?:[+-].*)?$/;

/**
 * Normalises a target {@code aprism} string by stripping the leading
 * {@code v}, any SemVer build suffix, and a stability marker so it can
 * be compared with a SemVer range. Returns the plain {@code major.minor.patch}
 * string or {@code null} when the value does not parse. Handles both
 * {@code v26.8-Alpha.7} (Aprism convention) and {@code 26.8.7} (standard SemVer).
 *
 * @param {string} value
 * @returns {string|null}
 */
function normaliseAprismVersion(value) {
    if (typeof value !== 'string') return null;
    const match = value.match(SEMVER_RELEASE);
    if (!match) return null;
    const patch = match[3] || match[4] || '0';
    return match[1] + '.' + match[2] + '.' + patch;
}
//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

/**
 * Returns the first verified profile that matches the requested
 * Minecraft and Aprism versions, or {@code null} when no profile
 * applies. The comparison accepts the stored Aprism string verbatim and
 * also matches the SemVer release form, so {@code "v26.8-Alpha.7"} and
 * {@code "26.8.7"} resolve to the same profile.
 *
 * @param {{minecraft?: string, aprism?: string}} target
 * @returns {{minecraft: string, aprism: string, aprismRange: string}|null}
 */


function findVerifiedProfile(target) {
    if (!target || typeof target !== 'object') return null;
    const minecraft = typeof target.minecraft === 'string' ? target.minecraft.trim() : '';
    const aprism = typeof target.aprism === 'string' ? target.aprism.trim() : '';
    if (!minecraft || !aprism) return null;
    for (const profile of VERIFIED_PROFILES) {
        if (profile.minecraft === minecraft) {
            if (profile.aprism === aprism) return profile;
            const normalisedTarget = normaliseAprismVersion(aprism);
            const normalisedStored = normaliseAprismVersion(profile.aprism);
            if (normalisedTarget && normalisedStored && normalisedTarget === normalisedStored) {
                return profile;
            }
        }
    }
    return null;
}

/**
 * Returns the list of profiles the validator accepts. Exposed for
 * diagnostics and for the GUI wizard to populate its selection.
 *
 * @returns {ReadonlyArray<{minecraft: string, aprism: string, aprismRange: string}>}
 */
function listVerifiedProfiles() {
    return VERIFIED_PROFILES;
}

module.exports = {findVerifiedProfile, listVerifiedProfiles, normaliseAprismVersion, VERIFIED_PROFILES};

