const webhookUrlField = document.getElementById('webhookUrlField')

const webhookNameField = document.getElementById('webhookNameField')

const webhookProfilePicField = document.getElementById('webhookProfilePicField')

const messageField = document.getElementById('messageField')
const sendButton = document.getElementById('sendButton')
const outputBox = document.getElementById('outputBox')

const openGitHubRepoButton = document.getElementById('openGitHubRepoButton')

const baseDiscordApiUrl = 'http://discordapp.com/api/v6' // gonna have to update this every now and then
const urlVerificationRegExp = /((http|https)(:\/\/))([a-zA-Z0-9]+[.]{1})?([a-zA-Z0-9]+[.]{1})[a-zA-z0-9]+(\/{1}[a-zA-Z0-9-_]+)*\/?/

let sending = false

function sendingComplete(success,data) {
	if (success) {
		outputBox.placeholder = 'Message sent!'
	} else {
		outputBox.placeholder = 'Sending failed: \n'+JSON.stringify(data)
	}
	sendButton.disabled = false
	sendButton.innerHTML = 'Send'
	sending = false
}

function send() {
	if (!sending) {
		sending = true
		sendButton.disabled = true
		sendButton.innerHTML = 'Sending...'
		outputBox.placeholder = ''

		// Parse provided data
		console.log(webhookUrlField.value)
		const filteredWebhookUrl = webhookUrlField.value.match(urlVerificationRegExp)
		if (!filteredWebhookUrl) {
			sendingComplete(false,'Webhook URL field doesn\'t contain a URL. Make sure it has a https:// prefix.')
			return
		}
		webhookUrlField.value = filteredWebhookUrl[0]
		const parsedUrl = new URL(filteredWebhookUrl[0])
		const parsedUrlPathname = parsedUrl.pathname.split('/')
		if (parsedUrl.hostname != 'discordapp.com') {
			sendingComplete(false,'Webhook url hostname is not discordapp.com')
			return
		} else if (parsedUrlPathname[1] != 'api' || parsedUrlPathname[2] != 'webhooks') {
			sendingComplete(false,'Invalid webhook url pathname component')
			return
		} else if (messageField.value.replace(/\s/g,'') == '') { // check if message is just whitespace
			sendingComplete(false,'Empty message field')
			return
		} else if (messageField.value.length > 2000) {
			sendingComplete(false,'Message length > 2000. Length is ' + messageField.value.length)
			return
		}
		const webhookId = parsedUrlPathname[3]
		const webhookToken = parsedUrlPathname[4]

		// Send request
		const requestBody = {
			content: messageField.value,
			username: webhookNameField.value,
			avatar_url: webhookProfilePicField.value,
		}
		const request = new XMLHttpRequest()

		request.onreadystatechange = function() {
			if (request.readyState == 4) {
				if (request.status >= 200 && request.status <= 299) {
					sendingComplete(true)
				} else {
					sendingComplete(false,`${request.status} ${response.statusText}`)
				}
			}
		}
		request.open('POST',`${baseDiscordApiUrl}/webhooks/${webhookId}/${webhookToken}`)
		//request.setRequestHeader('Content-Type','application/json')
		// CORS Preflight compliance?
		request.setRequestHeader('Content-Type','application/x-www-form-urlencoded')
		request.send(JSON.stringify(requestBody))
	}
}

// Load cached form data from cookie if exists and valid
let formData = Cookies.getJSON('Kiansjet/discord-ocw-web/formData')
if (formData) {
	if (typeof(formData.webhookUrl) == 'string') {
		webhookUrlField.value = formData.webhookUrl
	}
	if (typeof(formData.webhookName) == 'string') {
		webhookNameField.value = formData.webhookName
	}
	if (typeof(formData.webhookProfilePic) == 'string') {
		webhookProfilePicField.value = formData.webhookProfilePic
	}
}

// Save form data to cookie on window close
window.addEventListener('beforeunload',function(event) {
	Cookies.set('Kiansjet/discord-ocw-web/formData',{
		webhookUrl: webhookUrlField.value,
		webhookName: webhookNameField.value,
		webhookProfilePic: webhookProfilePicField.value,
	},{
		expires: 7, // days
		path: '', // restricts cookie to this url
		secure: true, // only load over https
	})
})

// General events
sendButton.addEventListener('click',send)
