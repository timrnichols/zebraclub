// ============================================
// THE ZEBRA CLUB - IN-APP ATTRIBUTION TRACKER
// ============================================
// ============================================

(function() {
    'use strict';
    
    // ============================================
    // CONFIGURATION
    // ============================================
    var CONFIG = {
        // Your Zapier webhook for conversion events
        webhookURL: 'ZAP Hook here',
        
        // Enable console logging
        debug: true,
        
        // GA4 Measurement ID (already installed: G-6C06Z7JHQD)
        ga4MeasurementId: 'G-6C06Z7JHQD'
    };
    
    // ============================================
    // COOKIE HELPER
    // ============================================
    function getCookie(name) {
        return document.cookie.split('; ').reduce(function(r, v) {
            var parts = v.split('=');
            return parts[0] === name ? decodeURIComponent(parts[1]) : r;
        }, '');
    }
    
    // ============================================
    // GET URL PARAMETERS
    // ============================================
    function getURLParam(name) {
        var params = new URLSearchParams(window.location.search);
        return params.get(name) || '';
    }
    
    // ============================================
    // READ ATTRIBUTION DATA
    // ============================================
    function getAttributionData() {
        // Try to get first-touch data from cookie (set by landing page)
        var firstTouchCookie = getCookie('tzc_first_touch');
        var firstTouch = null;
        
        try {
            if (firstTouchCookie) {
                firstTouch = JSON.parse(firstTouchCookie);
            }
        } catch (e) {
            if (CONFIG.debug) console.log('[TZC] Could not parse first touch cookie');
        }
        
        // Get visitor ID from cookie
        var visitorId = getCookie('tzc_visitor_id');
        
        // Also check URL params (in case passed through from landing page)
        var urlVisitorId = getURLParam('tzc_vid');
        
        return {
            visitor_id: visitorId || urlVisitorId || null,
            first_touch: firstTouch,
            // Current session UTMs (might be different from first touch)
            current_source: getURLParam('utm_source'),
            current_medium: getURLParam('utm_medium'),
            current_campaign: getURLParam('utm_campaign')
        };
    }
    
    // ============================================
    // SEND TO GA4 (via gtag)
    // ============================================
    function sendToGA4(eventName, eventParams) {
        if (typeof gtag === 'function') {
            gtag('event', eventName, eventParams);
            if (CONFIG.debug) console.log('[TZC] Sent to GA4:', eventName, eventParams);
        }
    }
    
    // ============================================
    // SEND TO AIRTABLE VIA WEBHOOK
    // ============================================
    function sendToWebhook(data) {
        if (CONFIG.webhookURL === 'YOUR_ZAPIER_WEBHOOK_URL_HERE') {
            if (CONFIG.debug) console.log('[TZC] Webhook not configured. Data:', data);
            return;
        }
        
        fetch(CONFIG.webhookURL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            mode: 'no-cors'
        }).catch(function(err) {
            if (CONFIG.debug) console.error('[TZC] Webhook error:', err);
        });
    }
    
    // ============================================
    // TRACK PAGE VIEW WITH ATTRIBUTION
    // ============================================
    function trackPageView() {
        var attribution = getAttributionData();
        
        if (attribution.visitor_id || attribution.first_touch) {
            var eventData = {
                event_category: 'attribution',
                tzc_visitor_id: attribution.visitor_id,
                page_path: window.location.pathname
            };
            
            if (attribution.first_touch) {
                eventData.first_touch_source = attribution.first_touch.utm_source;
                eventData.first_touch_medium = attribution.first_touch.utm_medium;
                eventData.first_touch_campaign = attribution.first_touch.utm_campaign;
            }
            
            sendToGA4('tzc_app_pageview', eventData);
            
            if (CONFIG.debug) {
                console.log('[TZC] Attribution data found:', attribution);
            }
        }
    }
    
    // ============================================
    // TRACK SIGNUP COMPLETION
    // ============================================
    // Call this when you detect a successful signup
    // You may need to customize the detection logic
    function trackSignupComplete(memberEmail, memberName) {
        var attribution = getAttributionData();
        
        var conversionData = {
            event_type: 'signup_complete',
            visitor_id: attribution.visitor_id,
            email: memberEmail || '',
            name: memberName || '',
            timestamp: new Date().toISOString(),
            page_url: window.location.href
        };
        
        if (attribution.first_touch) {
            conversionData.first_touch_source = attribution.first_touch.utm_source;
            conversionData.first_touch_medium = attribution.first_touch.utm_medium;
            conversionData.first_touch_campaign = attribution.first_touch.utm_campaign;
            conversionData.first_touch_timestamp = attribution.first_touch.timestamp;
        }
        
        // Send to GA4
        sendToGA4('sign_up', {
            method: 'email',
            tzc_visitor_id: attribution.visitor_id,
            first_touch_source: conversionData.first_touch_source,
            first_touch_medium: conversionData.first_touch_medium
        });
        
        // Send to Airtable
        sendToWebhook(conversionData);
        
        if (CONFIG.debug) {
            console.log('[TZC] Signup tracked:', conversionData);
        }
    }
    
    // ============================================
    // AUTO-DETECT SIGNUP SUCCESS (Optional)
    // ============================================
    // This attempts to detect when someone completes signup
    // Customize based on your app's behavior
    function setupSignupDetection() {
        // Method 1: URL-based detection
        // If signup redirects to a specific URL
        if (window.location.pathname.includes('/welcome') || 
            window.location.pathname.includes('/onboarding') ||
            window.location.pathname.includes('/home')) {
            
            // Check if this is a new visit (not returning member)
            var hasTrackedSignup = sessionStorage.getItem('tzc_signup_tracked');
            var attribution = getAttributionData();
            
            if (!hasTrackedSignup && attribution.visitor_id) {
                trackSignupComplete();
                sessionStorage.setItem('tzc_signup_tracked', 'true');
            }
        }
        
        // Method 2: Listen for specific elements appearing
        // Uncomment and customize if needed
        /*
        var observer = new MutationObserver(function(mutations) {
            var welcomeMessage = document.querySelector('[data-signup-success]');
            if (welcomeMessage) {
                trackSignupComplete();
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        */
    }
    
    // ============================================
    // EXPOSE GLOBAL FUNCTIONS
    // ============================================
    // These can be called manually if needed
    window.TZC = {
        trackSignup: trackSignupComplete,
        getAttribution: getAttributionData,
        debug: function() {
            console.log('[TZC] Attribution:', getAttributionData());
            console.log('[TZC] Cookies:', document.cookie);
            console.log('[TZC] URL:', window.location.href);
        }
    };
    
    // ============================================
    // INITIALIZE
    // ============================================
    trackPageView();
    setupSignupDetection();
    
    if (CONFIG.debug) {
        console.log('[TZC] In-app attribution tracker loaded');
        console.log('[TZC] Call TZC.debug() to see attribution data');
    }
    
})();
