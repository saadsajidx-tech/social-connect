import Toast from 'react-native-toast-message';
export const showToast = (
  errorMessage: string,
  title?: string,
  type?: string,
) => {
  Toast.show({
    type: type ?? 'error',
    text1: title ?? 'Error',
    text2: errorMessage,
    position: 'top',
    topOffset: 60,
  });
};
