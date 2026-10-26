---
name: outfit-recommendation-privacy
description: Implement outfit recommendations and optional virtual try-on while keeping body photos temporary and minimizing personal data.
---

# Privacy-first outfit recommendation

- Begin with explainable rules using viewed products, complementary categories, stock, price range and available sizes.
- Offer a generic avatar if the visitor declines photo upload.
- Validate image MIME type and size; preview locally when possible and revoke object URLs when the image is cleared or the component unmounts.
- Do not upload, store, log, index, or send body photos to analytics or third-party AI services by default.
- Never add body-photo or derived body-measurement fields to the database schema without a separately approved privacy and legal review.
- If a customer saves a look, save product IDs and chosen sizes to the cart, not the original photo.
- Camera capture must be initiated by the user with a clear browser permission prompt and a separate consent explanation.
- Clearly label demos as prototypes. Do not describe a static avatar as 3D or claim measurements are accurate unless a tested service provides them.
- Include a deletion path, retention policy and consent review before any external processing is introduced.
