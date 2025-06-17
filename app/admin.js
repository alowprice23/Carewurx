// This script handles the admin dashboard functionality.

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Admin page loading...');
    
    const userListElement = document.getElementById('user-list');
    
    // Add error message display
    function showAdminError(message) {
        let errorElement = document.getElementById('admin-error');
        if (!errorElement) {
            errorElement = document.createElement('p');
            errorElement.id = 'admin-error';
            errorElement.style.color = 'red';
            errorElement.style.fontWeight = 'bold';
            errorElement.style.margin = '20px 0';
            errorElement.style.padding = '10px';
            errorElement.style.backgroundColor = '#ffeeee';
            errorElement.style.borderRadius = '4px';
            document.querySelector('.container').insertBefore(errorElement, document.querySelector('h2'));
        }
        errorElement.textContent = message;
    }

    // Add success message display
    function showSuccessMessage(message) {
        let messageElement = document.getElementById('success-message');
        if (!messageElement) {
            messageElement = document.createElement('p');
            messageElement.id = 'success-message';
            messageElement.style.color = 'green';
            messageElement.style.fontWeight = 'bold';
            messageElement.style.margin = '20px 0';
            messageElement.style.padding = '10px';
            messageElement.style.backgroundColor = '#eeffee';
            messageElement.style.borderRadius = '4px';
            document.querySelector('.container').insertBefore(messageElement, document.querySelector('h2'));
        }
        messageElement.textContent = message;
        
        // Clear success message after 3 seconds
        setTimeout(() => {
            messageElement.textContent = '';
        }, 3000);
    }

    async function fetchUsers() {
        try {
            userListElement.innerHTML = '<li style="text-align: center; padding: 20px;">Loading users...</li>';
            console.log('Fetching users list...');
            const users = await window.electronAPI.listAllUsers();
            console.log('Users fetched:', users);
            displayUsers(users);
        } catch (error) {
            console.error("Error fetching users:", error);
            showAdminError("Failed to fetch user list: " + error.message);
            userListElement.innerHTML = '<li style="color: red;">Error loading users. Please try again.</li>';
        }
    }

    function displayUsers(users) {
        userListElement.innerHTML = ''; // Clear existing list

        if (!users || users.length === 0) {
            userListElement.innerHTML = '<li style="text-align: center; padding: 20px;">No users found.</li>';
            return;
        }

        users.forEach(user => {
            if (user.email === 'carewurx@gmail.com') return;

            const li = document.createElement('li');
            li.className = 'user-item';
            
            const isApproved = user.customClaims && user.customClaims.approved;

            li.innerHTML = `
                <span>${user.email} (UID: ${user.uid})</span>
                <div class="user-actions">
                    <button class="approve-btn" data-uid="${user.uid}" ${isApproved ? 'disabled' : ''}>
                        ${isApproved ? 'Approved ✓' : 'Approve'}
                    </button>
                    <button class="deny-btn" data-uid="${user.uid}" ${!isApproved ? 'disabled' : ''}>
                        ${!isApproved ? 'Denied ✗' : 'Deny'}
                    </button>
                    <button class="delete-btn" data-uid="${user.uid}">Delete</button>
                </div>
            `;
            userListElement.appendChild(li);
        });

        addEventListenersToButtons();
    }

    function addEventListenersToButtons() {
        document.querySelectorAll('.approve-btn').forEach(button => {
            button.addEventListener('click', handleApproval);
        });

        document.querySelectorAll('.deny-btn').forEach(button => {
            button.addEventListener('click', handleDenial);
        });
        
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', handleUserDeletion);
        });
    }
    
    async function handleUserDeletion(event) {
        const button = event.target;
        const uid = button.dataset.uid;
        const userEmail = button.closest('li').querySelector('span').textContent.split(' ')[0];
        
        // Confirm deletion
        if (!confirm(`Are you sure you want to permanently delete the user ${userEmail}? This action cannot be undone.`)) {
            return;
        }
        
        try {
            button.disabled = true;
            button.textContent = 'Deleting...';
            
            console.log('Deleting user:', uid);
            const result = await window.electronAPI.deleteUser(uid);
            
            if (result.success) {
                console.log('User deleted successfully');
                showSuccessMessage(`User ${userEmail} has been permanently deleted.`);
                
                // Remove the user from the list
                button.closest('li').remove();
            } else {
                console.error('Error deleting user:', result.error);
                showAdminError('Failed to delete user: ' + result.error);
                button.disabled = false;
                button.textContent = 'Delete';
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            showAdminError('Failed to delete user: ' + error.message);
            button.disabled = false;
            button.textContent = 'Delete';
        }
    }

    async function handleApproval(event) {
        const button = event.target;
        const uid = button.dataset.uid;
        
        try {
            button.disabled = true;
            button.textContent = 'Processing...';
            
            console.log('Approving user:', uid);
            await window.electronAPI.setUserApproval(uid, true);
            
            console.log('User approved successfully');
            button.textContent = 'Approved ✓';
            showSuccessMessage('User approved successfully!');
            
            // Enable the deny button
            const denyButton = button.parentElement.querySelector('.deny-btn');
            denyButton.disabled = false;
            denyButton.textContent = 'Deny';
            
        } catch (error) {
            console.error('Error approving user:', error);
            showAdminError('Failed to approve user: ' + error.message);
            button.disabled = false;
            button.textContent = 'Approve';
        }
    }

    async function handleDenial(event) {
        const button = event.target;
        const uid = button.dataset.uid;
        
        try {
            button.disabled = true;
            button.textContent = 'Processing...';
            
            console.log('Denying user:', uid);
            await window.electronAPI.setUserApproval(uid, false);
            
            console.log('User access denied');
            button.textContent = 'Denied ✗';
            showSuccessMessage('User access denied successfully.');
            
            // Enable the approve button
            const approveButton = button.parentElement.querySelector('.approve-btn');
            approveButton.disabled = false;
            approveButton.textContent = 'Approve';
            
        } catch (error) {
            console.error('Error denying user:', error);
            showAdminError('Failed to deny user access: ' + error.message);
            button.disabled = false;
            button.textContent = 'Deny';
        }
    }

    // Add a logout button
    function addLogoutButton() {
        const header = document.querySelector('h1');
        const logoutBtn = document.createElement('button');
        logoutBtn.textContent = 'Logout';
        logoutBtn.className = 'logout-btn';
        logoutBtn.style.marginLeft = '20px';
        logoutBtn.style.padding = '8px 15px';
        logoutBtn.style.cursor = 'pointer';
        logoutBtn.style.backgroundColor = '#f44336';
        logoutBtn.style.color = 'white';
        logoutBtn.style.border = 'none';
        logoutBtn.style.borderRadius = '4px';
        
        header.appendChild(logoutBtn);
        
        logoutBtn.addEventListener('click', async () => {
            try {
                await window.electronAPI.logout();
                window.location.href = 'index.html';
            } catch (error) {
                console.error('Logout error:', error);
                showAdminError('Failed to logout: ' + error.message);
            }
        });
    }

    function showLoginButton() {
        // Add a button to go back to login
        const backBtn = document.createElement('button');
        backBtn.textContent = 'Back to Login';
        backBtn.style.padding = '10px 20px';
        backBtn.style.margin = '20px 0';
        backBtn.style.cursor = 'pointer';
        backBtn.style.backgroundColor = '#4CAF50';
        backBtn.style.color = 'white';
        backBtn.style.border = 'none';
        backBtn.style.borderRadius = '4px';
        
        backBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
        
        userListElement.innerHTML = '';
        userListElement.appendChild(backBtn);
    }
    
    // Check if user is admin directly through IPC
    try {
        console.log('Checking current user...');
        const currentUser = await window.electronAPI.getCurrentUser();
        console.log('Current user:', currentUser);
        
        if (!currentUser) {
            console.log('No user is currently logged in');
            showAdminError('You must be logged in as admin to view this page.');
            showLoginButton();
            return;
        }
        
        if (currentUser.email !== 'carewurx@gmail.com') {
            console.log('User is not admin:', currentUser.email);
            showAdminError('Only carewurx@gmail.com can access the admin panel.');
            showLoginButton();
            return;
        }
        
        console.log('Admin user verified, initializing dashboard');
        addLogoutButton();
        await fetchUsers();
        
    } catch (error) {
        console.error('Error checking current user:', error);
        showAdminError('Error authenticating: ' + error.message);
        showLoginButton();
    }
});
