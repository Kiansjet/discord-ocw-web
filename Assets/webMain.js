let webhookUrlField,webhookNameField,webhookProfilePicField,messageField,sendButton,outputBox,openGitHubRepoButton

const baseDiscordApiUrl = 'https://discord.com/api/v6' // gonna have to update this every now and then
const savedFormDataCookieName = "Kiansjet/discord-ocw-web/formDataCookie"
const urlVerificationRegExp = /((http|https)(:\/\/))([a-zA-Z0-9]+[.]{1})?([a-zA-Z0-9]+[.]{1})[a-zA-z0-9]+(\/{1}[a-zA-Z0-9-_]+)*\/?/
const DEFAULT_WEBHOOK_DISPLAY_NAME = "Spidey Bot" // New api or whatever since some point doesnt allow empty name args
// TODO: Instead of this ^ consider fetching the webhook's info first with just the url and pulling the actual name out of that, provide a switch or smth

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
		const filteredWebhookUrl = webhookUrlField.value.match(urlVerificationRegExp)
		if (!filteredWebhookUrl) {
			sendingComplete(false,'Webhook URL field doesn\'t contain a URL. Make sure it has a https:// prefix.')
			return
		}
		webhookUrlField.value = filteredWebhookUrl[0]
		const parsedUrl = new URL(filteredWebhookUrl[0])
		const parsedUrlPathname = parsedUrl.pathname.split('/')
		if (parsedUrl.hostname != 'discord.com') {
			sendingComplete(false,'Webhook url hostname is not discord.com')
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
			username: webhookNameField.value.trim() || DEFAULT_WEBHOOK_DISPLAY_NAME, // This works cuz "" casts to a boolean false, careful casting now
			avatar_url: webhookProfilePicField.value,
		}
		const request = new XMLHttpRequest()

		request.onreadystatechange = function() {
			if (request.readyState == 4) {
				if (request.status >= 200 && request.status <= 299) {
					sendingComplete(true)
				} else {
					sendingComplete(false,`${request.status} ${request.response.statusText}`)
				}
			}
		}
		request.open('POST',`${baseDiscordApiUrl}/webhooks/${webhookId}/${webhookToken}`)
		request.setRequestHeader('Content-Type','application/json')
		// CORS Preflight compliance?
		//request.setRequestHeader('Content-Type','application/x-www-form-urlencoded')
		request.send(JSON.stringify(requestBody))
	}
}

// Save form data to cookie on window close
window.addEventListener('beforeunload',function(event) {
	Cookies.set(savedFormDataCookieName,JSON.stringify({
		webhookUrl: webhookUrlField.value,
		webhookName: webhookNameField.value,
		webhookProfilePic: webhookProfilePicField.value,
	}),{
		expires: 7, // days
		path: '', // restricts cookie to this url
		secure: true, // only load over https
		sameSite: "strict", // i think this is already handled with path but ok chrome
	})
})

document.addEventListener("DOMContentLoaded",function() {
	webhookUrlField = document.getElementById('webhookUrlField')

	webhookNameField = document.getElementById('webhookNameField')
	webhookNameField.placeholder = `Optional, defaults to "${DEFAULT_WEBHOOK_DISPLAY_NAME}"`

	webhookProfilePicField = document.getElementById('webhookProfilePicField')

	messageField = document.getElementById('messageField')
	sendButton = document.getElementById('sendButton')
	outputBox = document.getElementById('outputBox')

	openGitHubRepoButton = document.getElementById('openGitHubRepoButton')

	// Load cached form data from cookie if exists and valid
	//let formData = Cookies.getJSON('Kiansjet/discord-ocw-web/formData')
	let formData = Cookies.get(savedFormDataCookieName)
	if (formData) {
		formData = JSON.parse(formData)
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

	// General events
	sendButton.addEventListener('click',send)
})
