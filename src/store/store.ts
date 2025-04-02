import { configureStore } from "@reduxjs/toolkit";
import { combineReducers } from "redux";
import {
  useDispatch as useAppDispatch,
  useSelector as useAppSelector,
  TypedUseSelectorHook,
} from "react-redux";

// Custom Reducers
import fileReducer from "./FileSlice";

// Combine reducers
const rootReducer = combineReducers({
  file: fileReducer,
  // Add other reducers here
});

// Configure the store
const store = configureStore({
  reducer: rootReducer,
  // Add any middleware if needed

  // middleware: (getDefaultMiddleware) =>
  //   getDefaultMiddleware({
  //     serializableCheck: {
  //       ignoredPaths: ['file.videoBlob'],
  //       ignoredActions: ['file/setVideo'],
  //     },
  //   }),
});
// Export the store
export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
export const useDispatch = () => useAppDispatch<AppDispatch>();
export const useSelector: TypedUseSelectorHook<RootState> = useAppSelector;
export default store;
