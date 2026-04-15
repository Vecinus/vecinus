# 5-S3-software-review-guidelines.pdf

## Link to the deployment
- Backend: https://vecinus-backend-s3.onrender.com 
- Frontend: https://vecinus-s3.onrender.com

## Link to the GitHub release page
This release page was created by means of a command specifying the start and end dates of Sprint 3.

- https://github.com/Vecinus/vecinus/releases/tag/Sprint3

## Use cases developed in the deliverable
- Chat: Any user can make use of a communication channel that all neighbors share.

- AI Assistant (community chatbot): Any user can use a chatbot that answers doubts and queries about community rules. Administrators and presidents can upload context documents to it, such as laws or community rules.

- Reservations of common areas: Any user can reserve common spaces such as paddle tennis courts. Administrators or presidents can create new common areas along with their reservation policy.

- Incidents: Any user (except administrators) can report a problem or incident of the community. Additionally, anyone can see those created by other neighbors and check their status. Presidents, administrators, and employees can change their status. President and administrator can delete any incident. Any user can delete their own incident.

- Transcription of Minutes: Presidents and administrators can generate new minutes through the transcription platform. The rest of the users can only read them.

- Multi-community management: Administrators and presidents can switch between communities, create the community's dwellings, and invite new neighbors.

- Administrator registration: A new user can register in the system. Any user can create a new community in which they will be the administrator. (In the next sprint, an intermediate functionality between these two will be implemented to make payments in the application.)

## Failures and improvements identified by the PUGs

The following points summarize the issues detected during review, the corrective actions applied, and the final result obtained after validation by the QA, backend, and frontend teams.

### Failure 1: "Inconsistent Permissions in the 'President' Role"
"According to the functional specification, both the Administrator and the President should have the ability to invite people. However, the system denies this action to the President, stating that the permission is exclusive to the Administrator."

- Measure taken: The role permission logic was corrected in the backend to include the President role in the invite flow, and the frontend was updated to display the action for both authorized roles.
- Result achieved: Presidents can now invite members as specified, and the interface only exposes the action to users with permission.

### Failure 2: "Unable to update issue statuses with management roles"
"The system must allow both the Administrator and the President to update an issue's status. However, the system blocks this action for both roles, preventing issue lifecycle management."

- Measure taken: The authorization rules and status-update endpoint were fixed so that Administrators and Presidents can perform the change, and the UI was aligned with the corrected permissions.
- Result achieved: Issue status updates now work correctly for management roles and the issue lifecycle can be managed end to end.

### Failure 3: "Broken login"
"Non-functional login buttons and login actions triggering unexpected screens."

- Measure taken: The login button handlers and navigation logic were repaired, and the authentication flow was reviewed to ensure the correct screen is shown after a valid attempt.
- Result achieved: Login now submits properly and redirects users to the expected view without unexpected screen changes.

### Failure 4: "Sign-up is not working"
"Users are reporting that they are unable to register a new account."

- Measure taken: The registration form, validation, and backend sign-up endpoint were corrected to accept valid user data and complete the creation flow.
- Result achieved: New users can register successfully and receive a valid account in the system.

### Failure 5: "President role actions are not working as expected"
"The President has the functionality to remove members from the community, but the action is not working correctly."

- Measure taken: The member-removal action was fixed in both the backend permission checks and the frontend event handling for the President role.
- Result achieved: Presidents can now remove community members correctly, with the expected restrictions and feedback.

### Failure 6: "Buttons showing unexpected behavior"
"Status update buttons are visible to users who cannot change issue statuses."

- Measure taken: The visibility rules for action buttons were updated so they are only rendered for roles with status-change permissions.
- Result achieved: Unauthorized users no longer see status-update controls, reducing confusion and preventing invalid actions.

### Failure 7: "Issues encountered while booking a common area"
"Available time slots do not match facility hours, and 'Back to list' button is broken."

- Measure taken: The time-slot generation was aligned with each facility's real opening hours, and the back-navigation button was repaired.
- Result achieved: Booking now shows only valid available slots and the user can return to the list view without errors.

### Failure 8: "Infinite QR code generation when exiting and re-entering the screen"
"Able to generate additional QR codes by leaving and returning to the screen."

- Measure taken: QR code generation was moved behind a single controlled execution path so it only runs when needed and is not repeated on every screen revisit.
- Result achieved: Re-entering the screen no longer creates duplicate QR codes, and the generated code remains stable.

### Failure 9: "Document upload fails"
"An unexpected error message is displayed when attempting to upload a file to the chatbot."

- Measure taken: The upload flow was corrected by reviewing file validation, request handling, and server-side processing to return a proper response when a document is submitted.
- Result achieved: Document uploads now complete successfully and the chatbot can use the provided files as context.

### Failure 10: "Feature request"
"Ideally, pressing the Enter key should submit the message in the chatbot."

- Measure taken: An Enter-key handler was added to the chatbot input so the message is sent without needing to click the button.
- Result achieved: Chatbot usability improved, and users can submit messages faster with the keyboard.

## Data to perform the review

| Usuario | Email | Contraseña | Rol | 
| --- | --- | --- | --- |
| admin         | admin@prueba.com        | prueba     | Admin |
| empleado      | empleado@prueba.com     | prueba     | Empleado |
| josroddur     | josroddur@prueba.com    | prueba     | Empleado |
| juramo04      | juramo04@prueba.com     | prueba     | Propietario |
| presidente    | presidente@prueba.com   | prueba     | Presidente |
| vecino2       | vecino2@prueba.com      | prueba     | Inquilino |

## Potential requirements
It is necessary to access the backend first, and then the frontend once it comes out of hibernation.