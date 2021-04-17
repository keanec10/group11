//#region -> Vue

var app = new Vue({
	
	el: "#app",
	
	data: {
		
		// navigation
		pages: [
			{ key: "results", title: "RESULTS", img: "https://us02st1.zoom.us/static/94172/image/new/ZoomLogo.png" },
			{ key: "camera", title: "CAMERA", img: "https://vuejs.org/images/logo.png" },
			{ key: "info", title: "INFO", img: "https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_92x30dp.png" }
		],
		currentPage: null,
		nxtPage: null,
		
		// the test data
		logs: {
			index: [],
			tests: []
		},
		
		// test configuration
		activeTestCategory: "",
		cameraStage: "prep",
		cameraActive: false,
		currentTest: null
		
	},
	
	methods: {
		
		navigate: (pageKey) => {
			
			// don't trigger an update if the page wasn't changed
			if (pageKey === app.$data.currentPage) return;
			
			// preempt the page change with styling
			app.$data.nxtPage = pageKey;
			document.getElementById("main").style.opacity = "0";
			
			// wait for the styling to complete before displaying the new page
			setTimeout(() => {
				
				app.$data.currentPage = pageKey;
				document.getElementById("main").style.opacity = "1";
				
			}, 250);
			
		},
		
		addTestCategory: () => {
			
			// find the next available ID
			// since we are allowing users to remove test categories, a simple count won't suffice
			// adding the first test category is a special case where a normal array access would result in index [-1]
			const numTestCategories = app.$data.logs.index.length;
			let nxtTestCategoryID = 0;
			if (numTestCategories > 0) nxtTestCategoryID = (app.$data.logs.index[numTestCategories - 1].id + 1);
			
			
			// ask the user for the name of their new test category
			// if they left it blank, ignore it
			const newTestCategoryName = prompt("New test category name:");
			if (newTestCategoryName === null) return;
			
			
			// create the new object to be written to the data store
			// trim whitespace to avoid confusion when comparing names
			const newTestCategory = {
				name: newTestCategoryName.trim(),
				id: nxtTestCategoryID
			};
			
			// again, don't allow blank names
			if (newTestCategory.name === "") return;
			// also don't allow duplicate names
			if (app.$data.logs.index.findIndex((item) => (item.name === newTestCategory.name)) !== -1) {
				alert("A test category already exists with this name, please choose another name");
				return;
			}
			
			
			// append the new object to the dynamic data store
			app.$data.logs.index.push(newTestCategory);
			
			// write the updated data store to the file system
			updateLogs();
			
			
			// select the newly created test category in the drop down menu for nice user feedback
			app.$data.activeTestCategory = newTestCategory.id;
			
		},
		
		removeTestCategory: () => {
			
			// sanity check for the existence of the test category that is being removed
			const targetTestCategory = app.$data.activeTestCategory;
			const targetIndex = app.$data.logs.index.findIndex((item) => (item.id === targetTestCategory));
			if (targetIndex === -1) return;
			
			
			// confirm with the user that they would like to remove the test category
			// remind them that it will also delete all test results from that category
			const userOK = confirm("Removing '" + app.$data.logs.index[targetIndex].name + "' will remove all associated test results- is this ok?");
			if (!userOK) return;
			
			
			// remove the test category and its corresponding results from the dynamic data store
			app.$data.logs.index.splice(targetIndex, 1);
			app.$data.logs.tests = app.$data.logs.tests.filter(item => item.indexID !== targetTestCategory);
			
			// write the updated data store to the file system
			updateLogs();
			
			
			// reset the drop down menu for nice user feedback
			app.$data.activeTestCategory = "";
			
		},
		
		beginCameraCapture: () => {
			
			// ensure each test will belong to a particular category
			if (app.$data.activeTestCategory === "") {
				
				alert("Please select the test category this test will belong to before proceeding");
				
				return;
				
			}
			
			// toggling the loading screen is important because it forces Vue to refresh the camera stream
			app.navigate("loading");
			
			setTimeout(() => {
				
				// we only need to request the camera stream once during each session
				if (!app.$data.cameraActive) {
				
					navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then((stream) => {
						
						cameraFeed().srcObject = stream;
						app.$data.cameraActive = true;
						cameraFeed().play();
						app.$data.cameraStage = "capture";
						app.navigate("camera");
						
					});
					
				} else {
					
					cameraFeed().play();
					app.$data.cameraStage = "capture";
					app.navigate("camera");
					
				}
				
			}, 500);
			
		},
		
		conductTest: () => {
			
			cameraFeed().pause();
			app.navigate("loading");
			
			setTimeout(() => {
				
				// find the next available ID
				// since we are allowing users to remove tests, a simple count won't suffice
				// adding the first test is a special case where a normal array access would result in index [-1]
				const numTests = app.$data.logs.tests.length;
				let nxtTestID = 0;
				if (numTests > 0) nxtTestID = (app.$data.logs.tests[numTests - 1].id + 1);
				
				// create the new object to be written to the data store 
				const newTest = {
					id: nxtTestID,
					indexID: app.$data.activeTestCategory,
					count: processImage(),
					timestamp: new Date().toString()
				};
				
				app.$data.currentTest = newTest;
				app.$data.cameraStage = "result";
				app.navigate("camera");
				
			}, 500);
			
		},
		
		recordTest: () => {
			
			// if the user isn't happy with the test after reviewing, they can discard it
			const userOK = confirm("Would you like to save the results of this test? \n\n" + JSON.stringify(app.$data.currentTest, null, 4));
			
			if (userOK) {
				
				// append the new object to the dynamic data store
				app.$data.logs.tests.push(app.$data.currentTest);
					
				// write the updated data store to the file system
				updateLogs();
				
			}
			
			// reset the camera screen to the configuration section to prepare for the next testing
			app.$data.cameraStage = "prep";
			
		}
		
	}
	
});

//#endregion -> Vue


//#region -> image processing

const processImage = () => {

	// params
	// -> k means
	const K = 2;
	const MAX_KMEANS_ITERATIONS = 10;
	const MIN_KMEANS_ACCURACY = 1.0;
	const KMEANS_ATTEMPTS = 3;
	// -> morphology
	const EROSION_DIM = 5;
	const CLOSING_DIM = 3;
	// -> contours
	const MAX_COLONY_WIDTH = 500;
	const CONTOUR_THICKNESS = 2;
	// -> colours
	var GREEN = new cv.Scalar(0, 255, 0, 255);
	
	
	// the image processing
	
	// read the input image
	let src = new cv.Mat(cameraFeed().height, cameraFeed().width, cv.CV_8UC4);
	let cap = new cv.VideoCapture(cameraFeed());
	cap.read(src);
	
	
	// we need the image in floating-point form to use the "k means" method
	let data = new cv.Mat((src.rows * src.cols), 3, cv.CV_32F);
	for (var y = 0; y < src.rows; y++) {
		
		for (var x = 0; x < src.cols; x++) {
			
			for (var z = 0; z < 3; z++) {
				
				// access 1D array as if it were a 2D array
				data.floatPtr(y + (x * src.rows))[z] = src.ucharPtr(y, x)[z];
				
			}
			
		}
		
	}
	
	
	// "k means" works by reducing an image to its k most representitive colours
	// we would like to loosely separate into colony or agar, and we luckily don't have much other colour noise
	// so if we set k = 2, we are left with a very nice divide that we're looking for
	let labels = new cv.Mat();
	let criteria = new cv.TermCriteria(cv.TermCriteria_EPS + cv.TermCriteria_MAX_ITER, MAX_KMEANS_ITERATIONS, MIN_KMEANS_ACCURACY);
	let centers = new cv.Mat();
	cv.kmeans(data, K, labels, criteria, KMEANS_ATTEMPTS, cv.KMEANS_PP_CENTERS, centers);
	
	
	// we want to mask the image into colonies = white and agar = black
	// this is so that we can transform the colonies in the next section while ignoring the agar
	// however, "k means" labels the end colours randomly, so we can't 100% know if colonies are labelled 0 or 1 for our k = 2 case
	// we know that the agar will always be more voluminous than the colonies, so we can count the number of each labels
	// the label with the higher count is the agar, so we can colour black or white accordingly
	let count0 = 0;
	let count1 = 0;
	for (var y = 0; y < src.rows; y++) {
		
		for (var x = 0; x < src.cols; x++) {
			
			// fetch the current pixel's "k means" label
			// again, pseudo-2D 1D array access
			let clusterIdx = labels.intAt((y + (x * src.rows)), 0);
			if (clusterIdx == 0) count0++;
			if (clusterIdx == 1) count1++;
			
		}
		
	}
	
	
	// our colouring equation is: colour = 255*(idxBias - label)
	// where idxBias is a constant 0 or 1, and label is either 0 or 1 depending on the pixel's "k means" label
	// if there were more 0s than 1s then agar is the 0 label and colonies have the 1 label, so we set idxBias = 1
	// note that this makes our colour output 0 (black) for agar and 255 (white) for colonies
	// if there were more 1s than 0s, we just flip it around and it works the same way
	// this lets us always be sure we have colonies in white so they can be transformed next
	let idxBias = (count0 > count1) ? 0 : 1;
	let divided = new cv.Mat(src.size(), cv.CV_8UC1);
	for (var y = 0; y < src.rows; y++) {
		
		for (var x = 0; x < src.cols; x++) {
			
			// our above colour equation
			divided.ucharPtr(y, x)[0] = 255*(idxBias - labels.intAt((y + (x * src.rows)), 0));
			
		}
		
	}
	
	// leaving this in because if k > 2 this code will become relevant
	// and because without the threshold "divided" doesn't display
	// let grey = new cv.Mat(divided.size(), cv.CV_8UC1);
	// cv.cvtColor(divided, grey, cv.COLOR_RGBA2GRAY, 0);
	cv.threshold(divided, divided, 0, 255, (cv.THRESH_BINARY + cv.THRESH_OTSU));
	
	
	// attempt to separate close-together colonies by eroding their edges
	let kernelErode = cv.Mat.ones(EROSION_DIM, EROSION_DIM, cv.CV_8UC1);
	cv.erode(divided, divided, kernelErode, new cv.Point(-1, -1), 1, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue());
	
	
	// attempt to avoid needless duplicate colonies by filling in their gaps
	let kernelClose = cv.Mat.ones(CLOSING_DIM, CLOSING_DIM, cv.CV_8UC1);
	cv.morphologyEx(divided, divided, cv.MORPH_CLOSE, kernelClose);
	
	
	// count the number of potential colonies
	let contours = new cv.MatVector();
	let hierarchy = new cv.Mat();
	cv.findContours(divided, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
	
	
	// some areas of agar/background can be mistakenly labelled as colonies
	// these are typically always abnormally large, so if we filter each "colony" by a max width we should be rid of nearly all fake colonies
	// we can then draw the colony contours as an overlay over the original image for visual feedback
	let overlay = new cv.Mat();
	src.copyTo(overlay);
	for (var i = 0; i < contours.size(); i++) {
		
		// use the contour's bounding rectangle to filter by maximum width
		let boundingRectangle = cv.boundingRect(contours.get(i));
		if (boundingRectangle.width <= MAX_COLONY_WIDTH) cv.drawContours(overlay, contours, i, GREEN, CONTOUR_THICKNESS);
		
	}
	
	
	// display the outputs
	cv.imshow("imageProcessingOutput", overlay);
	
	// return the colony count
	const count = contours.size();
	
	// clean up OpenCV memory
	src.delete();
	data.delete();
	labels.delete();
	centers.delete();
	divided.delete();
	kernelClose.delete();
	kernelErode.delete();
	contours.delete();
	hierarchy.delete();
	overlay.delete();
	
	
	return count;
	
};

//#endregion -> image processing


//#region -> camera

const setUpCameraPermission = () => {
    
	if (cordova.platformId == "android") {
		
		const permissions = cordova.plugins.permissions;
		const cameraPermission = "android.permission.CAMERA";
		
		permissions.checkPermission(cameraPermission, (status) => {
			
			if (!status.hasPermission) {
				
				permissions.requestPermission(cameraPermission, (status) => {
					
					if (!status.hasPermission) {
					
						alert("App cannot proceed without permission to use the Camera, please try again");
						
						setUpCameraPermission();
						
					}
					
				});
			
			}
			
		});
	
	}
	
};

//#endregion -> camera


//#region -> file system

const updateLogs = () => {
	
	window.requestFileSystem(window.PERSISTENT, 0, (fs) => {
		
		fs.root.getFile("logs.json", { create: false }, (fileEntry) => {
			
			// overwrite the permanent data store with the updated dynamic data store
			fileEntry.createWriter((fileWriter) => fileWriter.write(new Blob([JSON.stringify(app.$data.logs)], { type: "text/plain" })));
			
		});
		
	});
	
};

// create the data store the first time the user opens the app
const initLogs = () => {
	
	window.requestFileSystem(window.PERSISTENT, 0, (fs) => {
		
		fs.root.getFile("logs.json", { create: true }, (fileEntry) => {
			
			fileEntry.createWriter((fileWriter) => {
				
				// initialise the dynamic data store when the permanent data store is initialised
				fileWriter.onwriteend = () => app.$data.logs = { index: [], tests: [] };
				
				// initialise the permanent data store structure
				fileWriter.write(new Blob([JSON.stringify({ index: [], tests: [] })], { type: "text/plain" }));
				
			});
			
		});
			
	});
	
};

const loadLogs = () => {
	
	window.requestFileSystem(window.PERSISTENT, 0, (fs) => {
		
		fs.root.getFile(
			
			"logs.json",
			{ create: false },
			
			// success: logs exist already
			(fileEntry) => {
				
				fileEntry.file((file) => {
					
					const reader = new FileReader();
					
					// load the permanent data store into the dynamic data store
					reader.onloadend = () => app.$data.logs = JSON.parse(reader.result);
					
					reader.readAsText(file);
					
				});
				
			},
			
			// failure: logs need to be created
			() => initLogs()
			
		)
		
	});
	
}

//#endregion -> file system


//#region -> init

const cameraFeed = () => document.getElementById("cameraFeed");

const initApp = () => {
	
	setUpCameraPermission();
	
	cameraFeed().width = window.innerWidth;
	cameraFeed().height = window.innerHeight;
	
	loadLogs();
	
	app.navigate("results");
	
};

document.addEventListener("deviceready", initApp);

//#endregion -> init
