import { Provider } from "mobx-react";
import ReactDOM from "react-dom";
import { BrowserRouter as Router } from "react-router-dom";
import { MainAppPage } from "views/MainAppPage";
import { AppModel } from "models/AppModel";


const theAppModel:AppModel = new AppModel();
ReactDOM.render(
    <Provider appModel={theAppModel}> 
        <Router>
            <MainAppPage />
        </Router>
    </Provider>,
    document.getElementById("root")
);     

